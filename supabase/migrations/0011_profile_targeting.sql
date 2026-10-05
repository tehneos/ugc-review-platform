-- =====================================================================
-- 0011: profil testera (godište, spol, interesi) i ciljanje kampanje
-- =====================================================================
-- Svi podaci profila su neobavezni. Kampanja bez ciljanja otvorena je svima.

alter table profiles add column if not exists birth_year int
  check (birth_year between 1900 and 2100);
alter table profiles add column if not exists gender text
  check (gender in ('female', 'male', 'other'));
alter table profiles add column if not exists interests text[] not null default '{}'
  check (cardinality(interests) <= 12 and interests <@ array[
    'hrana_pice', 'ljepota_njega', 'moda', 'dom_vrt', 'tehnika', 'sport',
    'auto_moto', 'djeca_bebe', 'kucni_ljubimci', 'zdravlje', 'hobi_alat', 'gaming']);
grant update (birth_year, gender, interests) on profiles to authenticated;

alter table campaigns add column if not exists target_gender text
  check (target_gender in ('female', 'male'));
alter table campaigns add column if not exists target_age_min int
  check (target_age_min between 18 and 99);
alter table campaigns add column if not exists target_age_max int
  check (target_age_max between 18 and 99);
alter table campaigns add column if not exists target_interests text[] not null default '{}'
  check (target_interests <@ array[
    'hrana_pice', 'ljepota_njega', 'moda', 'dom_vrt', 'tehnika', 'sport',
    'auto_moto', 'djeca_bebe', 'kucni_ljubimci', 'zdravlje', 'hobi_alat', 'gaming']);
grant select (target_gender, target_age_min, target_age_max, target_interests)
  on campaigns to anon, authenticated;

-- Odgovara li tester ciljanju kampanje. Ista pravila su u lib/targeting.ts (za prikaz).
create or replace function campaign_matches_profile(c campaigns, p profiles)
returns boolean
language sql stable set search_path = public as $$
  select (c.target_gender is null or p.gender = c.target_gender)
     and (c.target_age_min is null
          or (p.birth_year is not null
              and extract(year from now())::int - p.birth_year >= c.target_age_min))
     and (c.target_age_max is null
          or (p.birth_year is not null
              and extract(year from now())::int - p.birth_year <= c.target_age_max))
     and (cardinality(c.target_interests) = 0 or p.interests && c.target_interests);
$$;

create or replace function set_campaign_targeting(
  p_campaign_id uuid, p_gender text, p_age_min int, p_age_max int, p_interests text[]
) returns void
language plpgsql security definer set search_path = public as $$
declare v_c campaigns;
begin
  select * into v_c from campaigns where id = p_campaign_id;
  if v_c.id is null or auth.uid() is null or not is_brand_member(v_c.brand_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if v_c.status not in ('draft', 'active', 'paused') then raise exception 'INVALID_STATUS'; end if;
  if p_gender is not null and p_gender not in ('female', 'male') then raise exception 'INVALID_TARGETING'; end if;
  if (p_age_min is not null and p_age_min not between 18 and 99)
     or (p_age_max is not null and p_age_max not between 18 and 99)
     or (p_age_min is not null and p_age_max is not null and p_age_min > p_age_max) then
    raise exception 'INVALID_AGE_RANGE';
  end if;

  begin
    update campaigns
       set target_gender = p_gender, target_age_min = p_age_min, target_age_max = p_age_max,
           target_interests = coalesce(p_interests, '{}')
     where id = v_c.id;
  exception when check_violation then
    raise exception 'INVALID_TARGETING';
  end;
end $$;

-- Zauzimanje mjesta: dodana provjera ciljanja (NOT_ELIGIBLE)
create or replace function claim_campaign_slot(p_campaign_id uuid, p_shipping_address jsonb default null)
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

  select * into v_camp from campaigns where id = p_campaign_id;
  if v_camp.id is not null and not campaign_matches_profile(v_camp, v_profile) then
    raise exception 'NOT_ELIGIBLE';
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

revoke execute on function campaign_matches_profile(campaigns, profiles) from public, anon, authenticated;
revoke execute on function set_campaign_targeting(uuid, text, int, int, text[]) from public, anon;
grant  execute on function set_campaign_targeting(uuid, text, int, int, text[]) to authenticated;
