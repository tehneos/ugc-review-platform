-- =====================================================================
-- 0009: admin — upravljanje korisnicima, kampanjama i recenzijama
-- =====================================================================
-- Ništa se ne briše: korisnik se blokira, kampanja otkazuje, recenzija skriva.
-- Tako ostaje trag, a narudžbe i recenzije ne gube vezu s vlasnikom.

-- Korisnik: aktivan / suspendiran (na broj dana) / trajno blokiran
create or replace function admin_set_user_status(
  p_user_id uuid, p_status tester_status, p_days int default 30, p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if p_user_id = auth.uid() then raise exception 'CANNOT_CHANGE_SELF'; end if;
  if exists (select 1 from profiles where id = p_user_id and role = 'admin') then
    raise exception 'CANNOT_CHANGE_ADMIN';
  end if;

  update profiles
     set status = p_status,
         suspended_until = case when p_status = 'suspended'
                                then now() + make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365))
                           end
   where id = p_user_id;
  if not found then raise exception 'NOT_FOUND'; end if;

  insert into trust_events (tester_id, event_type, delta, note)
  values (p_user_id, 'manual', 0,
          'Admin: status ' || p_status || coalesce(' — ' || nullif(left(trim(p_note), 300), ''), ''));
end $$;

-- Ručna korekcija ocjene pouzdanosti
create or replace function admin_set_trust_score(p_user_id uuid, p_score int, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_old int;
begin
  if not is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if p_score is null or p_score not between 0 and 100 then raise exception 'INVALID_SCORE'; end if;
  select trust_score into v_old from profiles where id = p_user_id for update;
  if v_old is null then raise exception 'NOT_FOUND'; end if;

  update profiles set trust_score = p_score where id = p_user_id;
  insert into trust_events (tester_id, event_type, delta, note)
  values (p_user_id, 'manual', p_score - v_old,
          'Admin: korekcija' || coalesce(' — ' || nullif(left(trim(p_note), 300), ''), ''));
end $$;

-- Kampanja: pauza, nastavak ili otkazivanje. Otkazivanje oslobađa testere koji još nisu dobili proizvod.
create or replace function admin_set_campaign_status(p_campaign_id uuid, p_status campaign_status)
returns void
language plpgsql security definer set search_path = public as $$
declare v_c campaigns; v_n int;
begin
  if not is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if p_status not in ('active', 'paused', 'cancelled') then raise exception 'INVALID_STATUS'; end if;
  select * into v_c from campaigns where id = p_campaign_id for update;
  if v_c.id is null then raise exception 'NOT_FOUND'; end if;
  if v_c.status = 'cancelled' then raise exception 'INVALID_STATUS'; end if;

  if p_status = 'cancelled' then
    with c as (
      update orders set status = 'cancelled'
       where campaign_id = v_c.id and status in ('claimed', 'purchase_submitted')
      returning id
    ) select count(*) into v_n from c;
    update campaign_coupons set order_id = null, assigned_at = null
     where campaign_id = v_c.id
       and order_id in (select id from orders where campaign_id = v_c.id and status = 'cancelled');
    update campaigns
       set status = 'cancelled', slots_taken = greatest(slots_taken - v_n, 0)
     where id = v_c.id;
  else
    update campaigns set status = p_status, starts_at = coalesce(starts_at, now()) where id = v_c.id;
  end if;
end $$;

-- Ispravak teksta kampanje (pravopis, kriva poveznica, neprimjeren opis)
create or replace function admin_update_campaign(
  p_campaign_id uuid, p_title text, p_product_name text, p_product_url text,
  p_product_image_url text, p_description text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if char_length(trim(coalesce(p_title, ''))) < 3 or char_length(trim(coalesce(p_product_name, ''))) < 2 then
    raise exception 'INVALID_TITLE';
  end if;
  if coalesce(p_product_url, '') !~ '^https?://' then raise exception 'INVALID_URL'; end if;
  if coalesce(trim(p_product_image_url), '') <> '' and p_product_image_url !~ '^https://' then
    raise exception 'INVALID_IMAGE_URL';
  end if;

  update campaigns
     set title = trim(p_title), product_name = trim(p_product_name),
         product_url = trim(p_product_url),
         product_image_url = nullif(trim(coalesce(p_product_image_url, '')), ''),
         description = nullif(trim(coalesce(p_description, '')), '')
   where id = p_campaign_id;
  if not found then raise exception 'NOT_FOUND'; end if;
end $$;

-- Recenzija: admin je može sakriti ili vratiti, ali ne i mijenjati joj tekst ili ocjenu.
create or replace function admin_set_review_visibility(p_review_id uuid, p_hidden boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_r reviews;
begin
  if not is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  select * into v_r from reviews where id = p_review_id for update;
  if v_r.id is null then raise exception 'NOT_FOUND'; end if;

  if p_hidden then
    if v_r.status <> 'approved' then raise exception 'INVALID_STATUS'; end if;
    update reviews
       set status = 'flagged', rejection_note = nullif(left(trim(coalesce(p_note, '')), 500), ''),
           moderated_by = auth.uid(), moderated_at = now()
     where id = v_r.id;
  else
    if v_r.status <> 'flagged' then raise exception 'INVALID_STATUS'; end if;
    update reviews
       set status = 'approved', rejection_note = null, moderated_by = auth.uid(), moderated_at = now()
     where id = v_r.id;
  end if;
end $$;

revoke execute on function
  admin_set_user_status(uuid, tester_status, int, text), admin_set_trust_score(uuid, int, text),
  admin_set_campaign_status(uuid, campaign_status),
  admin_update_campaign(uuid, text, text, text, text, text),
  admin_set_review_visibility(uuid, boolean, text)
  from public, anon;
grant execute on function
  admin_set_user_status(uuid, tester_status, int, text), admin_set_trust_score(uuid, int, text),
  admin_set_campaign_status(uuid, campaign_status),
  admin_update_campaign(uuid, text, text, text, text, text),
  admin_set_review_visibility(uuid, boolean, text)
  to authenticated;
