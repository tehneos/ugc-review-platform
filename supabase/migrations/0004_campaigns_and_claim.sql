-- =====================================================================
-- 0004: kampanje — izrada, kuponi, objava; zauzimanje mjesta s adresom
-- =====================================================================

-- ---------- Izrada kampanje (nacrt) ---------------------------------
create or replace function create_campaign(
  p_brand_id uuid,
  p_title text,
  p_product_name text,
  p_product_url text,
  p_product_price numeric,
  p_discount_percent int,
  p_slots_total int,
  p_fulfillment_mode fulfillment_mode,
  p_coupon_mode coupon_mode default 'unique',
  p_shared_coupon_code text default null,
  p_description text default null,
  p_product_image_url text default null,
  p_purchase_instructions text default null,
  p_requirements text default null,
  p_min_photos int default 1
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_brand brands;
  v_slug  text;
  v_id    uuid;
begin
  if auth.uid() is null or not is_brand_member(p_brand_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  select * into v_brand from brands where id = p_brand_id;

  if p_fulfillment_mode = 'refund' then raise exception 'MODE_NOT_AVAILABLE'; end if;
  if char_length(trim(p_title)) < 3 or char_length(trim(p_product_name)) < 2 then
    raise exception 'INVALID_TITLE';
  end if;
  if p_product_url !~ '^https?://' then raise exception 'INVALID_URL'; end if;
  if p_product_image_url is not null and trim(p_product_image_url) <> ''
     and p_product_image_url !~ '^https://' then
    raise exception 'INVALID_IMAGE_URL';
  end if;
  if p_product_price is null or p_product_price <= 0 then raise exception 'INVALID_PRICE'; end if;
  if p_discount_percent not between 50 and 100 then raise exception 'INVALID_DISCOUNT'; end if;
  if p_slots_total not between 1 and 500 then raise exception 'INVALID_SLOTS'; end if;
  if p_min_photos not between 1 and 3 then raise exception 'INVALID_PHOTOS'; end if;
  if p_fulfillment_mode = 'coupon_purchase' and p_coupon_mode = 'shared'
     and coalesce(trim(p_shared_coupon_code), '') = '' then
    raise exception 'COUPON_REQUIRED';
  end if;

  v_slug := trim(both '-' from regexp_replace(
              translate(lower(trim(p_product_name)), 'čćžšđ', 'cczsd'),
              '[^a-z0-9]+', '-', 'g'));
  v_slug := left(coalesce(nullif(v_slug, ''), 'kampanja'), 50)
            || '-' || substr(encode(gen_random_bytes(4), 'hex'), 1, 6);

  insert into campaigns (
    brand_id, title, slug, description, product_name, product_url, product_image_url,
    product_price, country_code, currency, reward_type, discount_percent,
    coupon_mode, shared_coupon_code, slots_total, min_photos, requirements,
    fulfillment_mode, purchase_instructions
  ) values (
    p_brand_id, trim(p_title), v_slug, nullif(trim(p_description), ''),
    trim(p_product_name), trim(p_product_url), nullif(trim(p_product_image_url), ''),
    p_product_price, v_brand.country_code,
    (select currency from markets where country_code = v_brand.country_code),
    case when p_discount_percent = 100 then 'free_product'::reward_type
         else 'discount_percent'::reward_type end,
    p_discount_percent, p_coupon_mode,
    case when p_fulfillment_mode = 'coupon_purchase' and p_coupon_mode = 'shared'
         then trim(p_shared_coupon_code) end,
    p_slots_total, p_min_photos, nullif(trim(p_requirements), ''),
    p_fulfillment_mode, nullif(trim(p_purchase_instructions), '')
  ) returning id into v_id;
  return v_id;
end $$;

-- ---------- Uvoz jedinstvenih kupona --------------------------------
create or replace function add_campaign_coupons(p_campaign_id uuid, p_codes text[])
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_camp  campaigns;
  v_count int;
begin
  select * into v_camp from campaigns where id = p_campaign_id;
  if v_camp.id is null or auth.uid() is null or not is_brand_member(v_camp.brand_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if v_camp.fulfillment_mode <> 'coupon_purchase' or v_camp.coupon_mode <> 'unique' then
    raise exception 'COUPONS_NOT_USED';
  end if;
  if coalesce(array_length(p_codes, 1), 0) > 2000 then raise exception 'TOO_MANY_CODES'; end if;

  with ins as (
    insert into campaign_coupons (campaign_id, code)
    select distinct p_campaign_id, trim(c)
      from unnest(p_codes) as c
     where trim(c) <> '' and char_length(trim(c)) <= 64
    on conflict (campaign_id, code) do nothing
    returning 1
  ) select count(*) into v_count from ins;
  return v_count;
end $$;

-- ---------- Objava kampanje -----------------------------------------
-- Provjera pretplate i rezervacija kredita dolaze sa Stripeom (faza 3).
create or replace function publish_campaign(p_campaign_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_camp campaigns;
  v_free int;
begin
  select * into v_camp from campaigns where id = p_campaign_id for update;
  if v_camp.id is null or auth.uid() is null or not is_brand_member(v_camp.brand_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if v_camp.status not in ('draft', 'paused') then raise exception 'INVALID_STATUS'; end if;

  if v_camp.fulfillment_mode = 'coupon_purchase' and v_camp.coupon_mode = 'unique' then
    select count(*) into v_free from campaign_coupons
     where campaign_id = v_camp.id and order_id is null;
    if v_free < v_camp.slots_total - v_camp.slots_taken then
      raise exception 'NOT_ENOUGH_COUPONS';
    end if;
  end if;

  update campaigns
     set status = 'active', starts_at = coalesce(starts_at, now())
   where id = v_camp.id;
end $$;

create or replace function pause_campaign(p_campaign_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_camp campaigns;
begin
  select * into v_camp from campaigns where id = p_campaign_id for update;
  if v_camp.id is null or auth.uid() is null or not is_brand_member(v_camp.brand_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if v_camp.status <> 'active' then raise exception 'INVALID_STATUS'; end if;
  update campaigns set status = 'paused' where id = v_camp.id;
end $$;

-- Brend vidi svoje kupone (broj uvezenih / dodijeljenih)
create policy coupons_member_read on campaign_coupons for select
  using (exists (select 1 from campaigns c
                  where c.id = campaign_id and is_brand_member(c.brand_id)));

-- ---------- Zauzimanje mjesta: adresa za dostavu ---------------------
drop function claim_slot(uuid);

create or replace function claim_slot(p_campaign_id uuid, p_shipping_address jsonb default null)
returns orders
language plpgsql security definer set search_path = public as $$
declare
  v_user    uuid := auth.uid();
  v_profile profiles;
  v_camp    campaigns;
  v_order   orders;
  v_coupon  text;
  v_addr    jsonb;
begin
  select * into v_profile from profiles where id = v_user;
  if v_profile.id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if v_profile.role <> 'tester' then raise exception 'NOT_A_TESTER'; end if;
  if v_profile.status <> 'active' then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if exists (select 1 from orders where campaign_id = p_campaign_id and tester_id = v_user) then
    raise exception 'ALREADY_CLAIMED';
  end if;

  update campaigns
     set slots_taken = slots_taken + 1
   where id = p_campaign_id
     and status = 'active'
     and slots_taken < slots_total
     and (ends_at is null or ends_at > now())
     and min_trust_score <= v_profile.trust_score
     and country_code = v_profile.country_code
     and exists (select 1 from markets m
                  where m.country_code = campaigns.country_code and m.is_live)
  returning * into v_camp;
  if v_camp.id is null then raise exception 'CAMPAIGN_UNAVAILABLE'; end if;

  if v_camp.fulfillment_mode = 'brand_ships' then
    -- sprema se samo poznata polja, ne proizvoljan JSON
    v_addr := jsonb_build_object(
      'full_name', trim(p_shipping_address->>'full_name'),
      'street',    trim(p_shipping_address->>'street'),
      'postal_code', trim(p_shipping_address->>'postal_code'),
      'city',      trim(p_shipping_address->>'city'),
      'phone',     trim(p_shipping_address->>'phone'));
    if coalesce(v_addr->>'full_name', '') = '' or coalesce(v_addr->>'street', '') = ''
       or coalesce(v_addr->>'postal_code', '') = '' or coalesce(v_addr->>'city', '') = ''
       or char_length(v_addr::text) > 600 then
      raise exception 'ADDRESS_REQUIRED';
    end if;
  end if;

  insert into orders (campaign_id, brand_id, tester_id, purchase_due_at, shipping_address)
  values (v_camp.id, v_camp.brand_id, v_user,
          now() + make_interval(days => v_camp.purchase_deadline_days), v_addr)
  returning * into v_order;

  if v_camp.fulfillment_mode <> 'coupon_purchase' then
    return v_order;
  end if;

  if v_camp.coupon_mode = 'shared' then
    v_coupon := v_camp.shared_coupon_code;
  else
    update campaign_coupons set order_id = v_order.id, assigned_at = now()
     where id = (select id from campaign_coupons
                  where campaign_id = v_camp.id and order_id is null
                  limit 1 for update skip locked)
    returning code into v_coupon;
    if v_coupon is null then raise exception 'NO_COUPONS_LEFT'; end if;
  end if;

  update orders set coupon_code = v_coupon where id = v_order.id returning * into v_order;
  return v_order;
end $$;

-- ---------- Istek rokova: ne kažnjavati testera dok brend ne pošalje --
create or replace function expire_overdue_orders()
returns int
language plpgsql security definer set search_path = public as $$
declare v_count int := 0; r record;
begin
  -- nije kupio na vrijeme (samo kampanje s kuponom): mjesto se oslobađa
  for r in
    update orders o set status = 'expired'
      from campaigns c
     where c.id = o.campaign_id and c.fulfillment_mode = 'coupon_purchase'
       and o.status = 'claimed' and o.purchase_due_at < now()
    returning o.id, o.campaign_id, o.tester_id
  loop
    update campaigns set slots_taken = slots_taken - 1 where id = r.campaign_id;
    update campaign_coupons set order_id = null, assigned_at = null where order_id = r.id;
    insert into trust_events (tester_id, order_id, event_type, delta)
    values (r.tester_id, r.id, 'purchase_missed', -5);
    update profiles set trust_score = greatest(trust_score - 5, 0) where id = r.tester_id;
    v_count := v_count + 1;
  end loop;

  -- dobio proizvod, a nije poslao recenziju: suspenzija
  for r in
    update orders set status = 'expired'
     where status = 'purchase_verified' and review_due_at < now()
    returning id, tester_id
  loop
    insert into trust_events (tester_id, order_id, event_type, delta)
    values (r.tester_id, r.id, 'deadline_missed', -30);
    update profiles
       set trust_score = greatest(trust_score - 30, 0),
           missed_deadlines_count = missed_deadlines_count + 1,
           status = 'suspended',
           suspended_until = now() + interval '30 days'
     where id = r.tester_id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- ---------- Dozvole ---------------------------------------------------
revoke execute on function expire_overdue_orders() from public, anon, authenticated;
revoke execute on function
  create_campaign(uuid, text, text, text, numeric, int, int, fulfillment_mode, coupon_mode,
                  text, text, text, text, text, int),
  add_campaign_coupons(uuid, text[]),
  publish_campaign(uuid),
  pause_campaign(uuid),
  claim_slot(uuid, jsonb)
  from public, anon;
grant execute on function
  create_campaign(uuid, text, text, text, numeric, int, int, fulfillment_mode, coupon_mode,
                  text, text, text, text, text, int),
  add_campaign_coupons(uuid, text[]),
  publish_campaign(uuid),
  pause_campaign(uuid),
  claim_slot(uuid, jsonb)
  to authenticated;
