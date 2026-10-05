-- =====================================================================
-- 0007: recenzija i na webshopu brenda (kopija nakon odobrenja)
-- =====================================================================

alter table campaigns add column if not exists external_review_url text;
grant select (external_review_url) on campaigns to anon, authenticated;

alter table reviews add column if not exists external_posted_at timestamptz;
alter table reviews add column if not exists external_confirmed_at timestamptz;

-- Poveznica na stranicu brenda gdje tester ostavlja kopiju recenzije (prazno = isključeno)
create or replace function set_campaign_review_url(p_campaign_id uuid, p_url text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_c   campaigns;
  v_url text := nullif(trim(coalesce(p_url, '')), '');
begin
  select * into v_c from campaigns where id = p_campaign_id;
  if v_c.id is null or auth.uid() is null or not is_brand_member(v_c.brand_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if v_url is not null and (v_url !~ '^https?://' or char_length(v_url) > 500) then
    raise exception 'INVALID_REVIEW_URL';
  end if;
  update campaigns set external_review_url = v_url where id = v_c.id;
end $$;

-- Tester: "objavio sam i na stranici brenda" (tek nakon odobrenja teksta)
create or replace function mark_external_posted(p_review_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_r reviews;
begin
  select * into v_r from reviews where id = p_review_id for update;
  if v_r.id is null or auth.uid() is null or v_r.tester_id <> auth.uid() then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if v_r.status <> 'approved' or v_r.external_posted_at is not null
     or not exists (select 1 from campaigns
                     where id = v_r.campaign_id and external_review_url is not null) then
    raise exception 'INVALID_STATUS';
  end if;
  update reviews set external_posted_at = now() where id = v_r.id;
end $$;

-- Brend potvrđuje da se recenzija pojavila; tester dobiva preostale bodove
create or replace function confirm_external_review(p_review_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_r reviews;
begin
  select * into v_r from reviews where id = p_review_id for update;
  if v_r.id is null or auth.uid() is null or not is_brand_member(v_r.brand_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if v_r.external_posted_at is null or v_r.external_confirmed_at is not null then
    raise exception 'INVALID_STATUS';
  end if;

  update reviews set external_confirmed_at = now() where id = v_r.id;
  update profiles set trust_score = least(trust_score + 3, 100) where id = v_r.tester_id;
  insert into trust_events (tester_id, order_id, event_type, delta)
  values (v_r.tester_id, v_r.order_id, 'external_review_confirmed', 3);
end $$;

-- Odobrenje: 5 bodova; uz kopiju na webshopu 2 odmah i 3 nakon potvrde brenda
create or replace function _approve_review(p_review_id uuid, p_moderator uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_r      reviews;
  v_points int;
begin
  update reviews
     set status = 'approved', published_at = now(), moderated_at = now(), moderated_by = p_moderator
   where id = p_review_id and status = 'pending'
  returning * into v_r;
  if v_r.id is null then return false; end if;

  select case when external_review_url is null then 5 else 2 end into v_points
    from campaigns where id = v_r.campaign_id;

  update orders set status = 'completed', completed_at = now() where id = v_r.order_id;
  update profiles
     set trust_score = least(trust_score + v_points, 100),
         completed_reviews_count = completed_reviews_count + 1
   where id = v_r.tester_id;
  insert into trust_events (tester_id, order_id, event_type, delta)
  values (v_r.tester_id, v_r.order_id, 'review_approved', v_points);
  return true;
end $$;

revoke execute on function _approve_review(uuid, uuid) from public, anon, authenticated;
revoke execute on function
  set_campaign_review_url(uuid, text), mark_external_posted(uuid), confirm_external_review(uuid)
  from public, anon;
grant execute on function
  set_campaign_review_url(uuid, text), mark_external_posted(uuid), confirm_external_review(uuid)
  to authenticated;
