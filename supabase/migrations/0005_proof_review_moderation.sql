-- =====================================================================
-- 0005: dokaz kupnje, dostava, recenzija s fotografijama, moderacija
-- =====================================================================

alter table reviews add column if not exists resubmitted boolean not null default false;
-- Fotografije zamijenjene pri ponovnom slanju ostaju u tablici, ali se ne prikazuju.
alter table review_media add column if not exists removed_at timestamptz;

-- Brend smije otvoriti dokaz kupnje samo za vlastite narudžbe
create policy purchase_proofs_read_brand on storage.objects for select to authenticated
  using (bucket_id = 'purchase-proofs'
         and exists (select 1 from public.orders o
                      where o.proof_file_path = name and public.is_brand_member(o.brand_id)));

-- ---------- Tester: dokaz kupnje ------------------------------------
create or replace function submit_purchase_proof(
  p_order_id uuid, p_order_number text, p_proof_path text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_o    orders;
  v_c    campaigns;
  v_num  text := nullif(left(trim(coalesce(p_order_number, '')), 80), '');
  v_path text := nullif(trim(coalesce(p_proof_path, '')), '');
begin
  select * into v_o from orders where id = p_order_id for update;
  if v_o.id is null or v_uid is null or v_o.tester_id <> v_uid then
    raise exception 'NOT_AUTHORIZED';
  end if;
  select * into v_c from campaigns where id = v_o.campaign_id;
  if v_c.fulfillment_mode <> 'coupon_purchase' or v_o.status <> 'claimed' then
    raise exception 'INVALID_STATUS';
  end if;
  if v_num is null and v_path is null then raise exception 'PROOF_REQUIRED'; end if;
  if v_path is not null and (
       v_path not like v_uid::text || '/%' or position('..' in v_path) > 0
       or not exists (select 1 from storage.objects
                       where bucket_id = 'purchase-proofs' and name = v_path)) then
    raise exception 'INVALID_FILE';
  end if;

  begin
    update orders
       set status = 'purchase_submitted', external_order_number = v_num,
           proof_file_path = v_path, rejection_note = null
     where id = v_o.id;
  exception when unique_violation then
    raise exception 'ORDER_NUMBER_USED';
  end;
end $$;

-- ---------- Brend: potvrda / odbijanje kupnje ------------------------
create or replace function verify_purchase(p_order_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_o orders; v_c campaigns;
begin
  select * into v_o from orders where id = p_order_id for update;
  if v_o.id is null or auth.uid() is null or not is_brand_member(v_o.brand_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if v_o.status <> 'purchase_submitted' then raise exception 'INVALID_STATUS'; end if;
  select * into v_c from campaigns where id = v_o.campaign_id;

  update orders
     set status = 'purchase_verified', verification_method = 'manual',
         purchase_verified_at = now(), verified_by = auth.uid(),
         review_due_at = now() + make_interval(days => v_c.review_deadline_days)
   where id = v_o.id;
end $$;

-- Odbijen dokaz: tester ga smije poslati ponovno, s najmanje 2 dana roka.
create or replace function reject_purchase(p_order_id uuid, p_note text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_o orders;
begin
  select * into v_o from orders where id = p_order_id for update;
  if v_o.id is null or auth.uid() is null or not is_brand_member(v_o.brand_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if v_o.status <> 'purchase_submitted' then raise exception 'INVALID_STATUS'; end if;
  if char_length(trim(coalesce(p_note, ''))) < 3 then raise exception 'NOTE_REQUIRED'; end if;

  update orders
     set status = 'claimed', rejection_note = left(trim(p_note), 500),
         purchase_due_at = greatest(purchase_due_at, now() + interval '2 days')
   where id = v_o.id;
end $$;

-- ---------- Dostava (brend šalje proizvod) ---------------------------
create or replace function mark_shipped(p_order_id uuid, p_tracking_number text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_o orders; v_c campaigns;
begin
  select * into v_o from orders where id = p_order_id for update;
  if v_o.id is null or auth.uid() is null or not is_brand_member(v_o.brand_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  select * into v_c from campaigns where id = v_o.campaign_id;
  if v_c.fulfillment_mode <> 'brand_ships' or v_o.status <> 'claimed' or v_o.shipped_at is not null then
    raise exception 'INVALID_STATUS';
  end if;

  update orders
     set shipped_at = now(),
         tracking_number = nullif(left(trim(coalesce(p_tracking_number, '')), 80), '')
   where id = v_o.id;
end $$;

create or replace function confirm_received(p_order_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_o orders; v_c campaigns;
begin
  select * into v_o from orders where id = p_order_id for update;
  if v_o.id is null or auth.uid() is null or v_o.tester_id <> auth.uid() then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if v_o.status <> 'claimed' or v_o.shipped_at is null then raise exception 'INVALID_STATUS'; end if;
  select * into v_c from campaigns where id = v_o.campaign_id;

  update orders
     set status = 'purchase_verified', received_at = now(),
         review_due_at = now() + make_interval(days => v_c.review_deadline_days)
   where id = v_o.id;
end $$;

-- ---------- Tester: recenzija ----------------------------------------
create or replace function submit_review(
  p_order_id uuid, p_rating int, p_title text, p_body text,
  p_photo_paths text[], p_media_consent boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_o    orders;
  v_c    campaigns;
  v_p    profiles;
  v_r    reviews;
  v_id   uuid;
  v_path text;
  v_n    int := coalesce(array_length(p_photo_paths, 1), 0);
  v_body text := trim(coalesce(p_body, ''));
  v_name text;
begin
  select * into v_o from orders where id = p_order_id for update;
  if v_o.id is null or v_uid is null or v_o.tester_id <> v_uid then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if v_o.status <> 'purchase_verified' then raise exception 'INVALID_STATUS'; end if;
  select * into v_c from campaigns where id = v_o.campaign_id;
  select * into v_p from profiles where id = v_uid;

  if p_rating is null or p_rating not between 1 and 5 then raise exception 'INVALID_RATING'; end if;
  if char_length(v_body) < 30 then raise exception 'BODY_TOO_SHORT'; end if;
  if char_length(v_body) > 3000 then raise exception 'BODY_TOO_LONG'; end if;
  if v_n < v_c.min_photos or v_n > 3 then raise exception 'PHOTOS_REQUIRED'; end if;

  foreach v_path in array p_photo_paths loop
    if v_path not like v_uid::text || '/%' or position('..' in v_path) > 0
       or not exists (select 1 from storage.objects
                       where bucket_id = 'review-media' and name = v_path) then
      raise exception 'INVALID_FILE';
    end if;
  end loop;

  if v_p.media_consent_at is null then
    if not coalesce(p_media_consent, false) then raise exception 'CONSENT_REQUIRED'; end if;
    update profiles set media_consent_at = now() where id = v_uid;
  end if;

  v_name := coalesce(nullif(trim(v_p.display_name), ''),
                     nullif(split_part(trim(coalesce(v_p.full_name, '')), ' ', 1), ''),
                     'Tester');

  select * into v_r from reviews where order_id = v_o.id;
  if v_r.id is null then
    insert into reviews (order_id, campaign_id, brand_id, tester_id, rating, title, body, display_name)
    values (v_o.id, v_o.campaign_id, v_o.brand_id, v_uid, p_rating,
            nullif(left(trim(coalesce(p_title, '')), 120), ''), v_body, v_name)
    returning id into v_id;
  else
    -- odbijena recenzija smije se ispraviti i poslati jednom
    if v_r.status <> 'rejected' or v_r.resubmitted then raise exception 'INVALID_STATUS'; end if;
    v_id := v_r.id;
    update reviews
       set rating = p_rating, title = nullif(left(trim(coalesce(p_title, '')), 120), ''),
           body = v_body, display_name = v_name, status = 'pending', resubmitted = true,
           rejection_reason = null, rejection_note = null, moderated_by = null, moderated_at = null
     where id = v_id;
    update review_media set removed_at = now() where review_id = v_id and position >= v_n;
  end if;

  insert into review_media (review_id, storage_path, position)
  select v_id, t.p, t.ord - 1 from unnest(p_photo_paths) with ordinality as t(p, ord)
  on conflict (review_id, position)
  do update set storage_path = excluded.storage_path, removed_at = null;

  update orders set status = 'review_submitted' where id = v_o.id;
  return v_id;
end $$;

-- ---------- Odobrenje (interno; zovu ga moderacija i automatika) -----
create or replace function _approve_review(p_review_id uuid, p_moderator uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_r reviews;
begin
  update reviews
     set status = 'approved', published_at = now(), moderated_at = now(), moderated_by = p_moderator
   where id = p_review_id and status = 'pending'
  returning * into v_r;
  if v_r.id is null then return false; end if;

  update orders set status = 'completed', completed_at = now() where id = v_r.order_id;
  update profiles
     set trust_score = least(trust_score + 5, 100),
         completed_reviews_count = completed_reviews_count + 1
   where id = v_r.tester_id;
  insert into trust_events (tester_id, order_id, event_type, delta)
  values (v_r.tester_id, v_r.order_id, 'review_approved', 5);
  -- naplata po recenziji (billing_events, krediti) dolazi sa Stripeom u fazi 3
  return true;
end $$;

-- ---------- Brend: moderacija ----------------------------------------
-- Nema razloga "negativna ocjena": odbiti se može samo uz razlog s popisa.
create or replace function moderate_review(
  p_review_id uuid, p_approve boolean,
  p_reason rejection_reason default null, p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_r reviews;
begin
  select * into v_r from reviews where id = p_review_id for update;
  if v_r.id is null or auth.uid() is null or not is_brand_member(v_r.brand_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if v_r.status <> 'pending' then raise exception 'INVALID_STATUS'; end if;

  if p_approve then
    perform _approve_review(v_r.id, auth.uid());
    return;
  end if;

  if p_reason is null then raise exception 'REASON_REQUIRED'; end if;
  if p_reason = 'other' and char_length(trim(coalesce(p_note, ''))) < 10 then
    raise exception 'NOTE_REQUIRED';
  end if;

  update reviews
     set status = 'rejected', rejection_reason = p_reason,
         rejection_note = nullif(left(trim(coalesce(p_note, '')), 500), ''),
         moderated_at = now(), moderated_by = auth.uid()
   where id = v_r.id;

  if not v_r.resubmitted then
    update orders
       set status = 'purchase_verified',
           review_due_at = greatest(review_due_at, now() + interval '3 days')
     where id = v_r.order_id;
  else
    update orders set status = 'rejected' where id = v_r.order_id;
    update profiles set trust_score = greatest(trust_score - 10, 0) where id = v_r.tester_id;
    insert into trust_events (tester_id, order_id, event_type, delta)
    values (v_r.tester_id, v_r.order_id, 'review_rejected', -10);
  end if;
end $$;

-- ---------- Automatika (svaki sat) -----------------------------------
create or replace function run_hourly_maintenance()
returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  perform expire_overdue_orders();

  -- tester nije potvrdio primitak: nakon 7 dana od slanja smatra se primljenim
  update orders o
     set status = 'purchase_verified', received_at = now(),
         review_due_at = now() + make_interval(days => c.review_deadline_days)
    from campaigns c
   where c.id = o.campaign_id and o.status = 'claimed'
     and o.shipped_at is not null and o.shipped_at < now() - interval '7 days';

  -- brend nije moderirao 5 dana: recenzija se odobrava automatski
  for r in select id from reviews
            where status = 'pending' and updated_at < now() - interval '5 days'
  loop
    perform _approve_review(r.id, null);
  end loop;
end $$;

select cron.schedule('expire-overdue-orders', '5 * * * *',
  $$select public.run_hourly_maintenance()$$);

-- ---------- Dozvole ---------------------------------------------------
revoke execute on function _approve_review(uuid, uuid), run_hourly_maintenance()
  from public, anon, authenticated;
revoke execute on function
  submit_purchase_proof(uuid, text, text), verify_purchase(uuid), reject_purchase(uuid, text),
  mark_shipped(uuid, text), confirm_received(uuid),
  submit_review(uuid, int, text, text, text[], boolean),
  moderate_review(uuid, boolean, rejection_reason, text)
  from public, anon;
grant execute on function
  submit_purchase_proof(uuid, text, text), verify_purchase(uuid), reject_purchase(uuid, text),
  mark_shipped(uuid, text), confirm_received(uuid),
  submit_review(uuid, int, text, text, text[], boolean),
  moderate_review(uuid, boolean, rejection_reason, text)
  to authenticated;
