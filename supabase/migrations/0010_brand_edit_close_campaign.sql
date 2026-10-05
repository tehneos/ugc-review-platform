-- =====================================================================
-- 0010: brend uređuje, zatvara i briše vlastitu kampanju
-- =====================================================================
-- Pravilo: nakon što tester zauzme mjesto, uvjeti na koje je pristao više se ne mijenjaju.

alter table campaigns add column if not exists deleted_at timestamptz;
grant select (deleted_at) on campaigns to anon, authenticated;

-- null = polje ostaje kakvo jest; prazan tekst = briše neobavezno polje
create or replace function update_campaign(
  p_campaign_id uuid,
  p_title text default null,
  p_description text default null,
  p_product_url text default null,
  p_product_image_url text default null,
  p_purchase_instructions text default null,
  p_requirements text default null,
  p_slots_total int default null,
  p_product_name text default null,
  p_product_price numeric default null,
  p_discount_percent int default null,
  p_min_photos int default null,
  p_fulfillment_mode fulfillment_mode default null,
  p_coupon_mode coupon_mode default null,
  p_shared_coupon_code text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_c       campaigns;
  v_claims  boolean;
  v_title   text;
  v_name    text;
  v_url     text;
  v_image   text;
  v_price   numeric;
  v_disc    int;
  v_photos  int;
  v_slots   int;
  v_mode    fulfillment_mode;
  v_cmode   coupon_mode;
  v_code    text;
  v_free    int;
begin
  select * into v_c from campaigns where id = p_campaign_id for update;
  if v_c.id is null or auth.uid() is null or not is_brand_member(v_c.brand_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if v_c.status not in ('draft', 'active', 'paused') then raise exception 'INVALID_STATUS'; end if;
  v_claims := exists (select 1 from orders where campaign_id = v_c.id);

  v_title  := trim(coalesce(p_title, v_c.title));
  v_name   := trim(coalesce(p_product_name, v_c.product_name));
  v_url    := trim(coalesce(p_product_url, v_c.product_url));
  v_image  := case when p_product_image_url is null then v_c.product_image_url
                   else nullif(trim(p_product_image_url), '') end;
  v_price  := coalesce(p_product_price, v_c.product_price);
  v_disc   := coalesce(p_discount_percent, v_c.discount_percent);
  v_photos := coalesce(p_min_photos, v_c.min_photos);
  v_slots  := coalesce(p_slots_total, v_c.slots_total);
  v_mode   := coalesce(p_fulfillment_mode, v_c.fulfillment_mode);
  v_cmode  := coalesce(p_coupon_mode, v_c.coupon_mode);
  v_code   := coalesce(nullif(trim(coalesce(p_shared_coupon_code, '')), ''), v_c.shared_coupon_code);

  if v_claims and (v_name <> v_c.product_name or v_price <> v_c.product_price
                   or v_disc <> v_c.discount_percent or v_photos <> v_c.min_photos
                   or v_mode <> v_c.fulfillment_mode or v_cmode <> v_c.coupon_mode) then
    raise exception 'LOCKED_AFTER_CLAIM';
  end if;
  if v_c.status <> 'draft' and (v_mode <> v_c.fulfillment_mode or v_cmode <> v_c.coupon_mode) then
    raise exception 'MODE_LOCKED';
  end if;

  if v_mode = 'refund' then raise exception 'MODE_NOT_AVAILABLE'; end if;
  if char_length(v_title) < 3 or char_length(v_name) < 2 then raise exception 'INVALID_TITLE'; end if;
  if v_url !~ '^https?://' then raise exception 'INVALID_URL'; end if;
  if v_image is not null and v_image !~ '^https://' then raise exception 'INVALID_IMAGE_URL'; end if;
  if v_price <= 0 then raise exception 'INVALID_PRICE'; end if;
  if v_disc not between 50 and 100 then raise exception 'INVALID_DISCOUNT'; end if;
  if v_photos not between 1 and 3 then raise exception 'INVALID_PHOTOS'; end if;
  if v_slots not between 1 and 500 or v_slots < v_c.slots_taken
     or (v_claims and v_slots < v_c.slots_total) then
    raise exception 'INVALID_SLOTS';
  end if;
  if v_mode = 'coupon_purchase' and v_cmode = 'shared' and v_code is null then
    raise exception 'COUPON_REQUIRED';
  end if;
  if v_c.status = 'active' and v_mode = 'coupon_purchase' and v_cmode = 'unique' then
    select count(*) into v_free from campaign_coupons where campaign_id = v_c.id and order_id is null;
    if v_free < v_slots - v_c.slots_taken then raise exception 'NOT_ENOUGH_COUPONS'; end if;
  end if;

  update campaigns
     set title = v_title, product_name = v_name, product_url = v_url, product_image_url = v_image,
         description = case when p_description is null then description
                            else nullif(trim(p_description), '') end,
         purchase_instructions = case when p_purchase_instructions is null then purchase_instructions
                                      else nullif(trim(p_purchase_instructions), '') end,
         requirements = case when p_requirements is null then requirements
                             else nullif(trim(p_requirements), '') end,
         product_price = v_price, discount_percent = v_disc, min_photos = v_photos,
         slots_total = v_slots, fulfillment_mode = v_mode, coupon_mode = v_cmode,
         shared_coupon_code = case when v_mode = 'coupon_purchase' and v_cmode = 'shared' then v_code end,
         reward_type = case when v_disc = 100 then 'free_product'::reward_type
                            else 'discount_percent'::reward_type end
   where id = v_c.id;
end $$;

-- Bez testera: kampanja se briše (nestaje iz popisa, ostaje u bazi kao trag).
-- S testerima: zatvara se za nove prijave, a postojeći testeri dovršavaju test.
create or replace function close_campaign(p_campaign_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare v_c campaigns;
begin
  select * into v_c from campaigns where id = p_campaign_id for update;
  if v_c.id is null or auth.uid() is null or not is_brand_member(v_c.brand_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if v_c.status not in ('draft', 'active', 'paused') then raise exception 'INVALID_STATUS'; end if;

  if exists (select 1 from orders where campaign_id = v_c.id) then
    update campaigns set status = 'completed', ends_at = now() where id = v_c.id;
    return 'closed';
  end if;
  update campaigns set status = 'cancelled', deleted_at = now() where id = v_c.id;
  return 'deleted';
end $$;

revoke execute on function
  update_campaign(uuid, text, text, text, text, text, text, int, text, numeric, int, int,
                  fulfillment_mode, coupon_mode, text),
  close_campaign(uuid)
  from public, anon;
grant execute on function
  update_campaign(uuid, text, text, text, text, text, text, int, text, numeric, int, int,
                  fulfillment_mode, coupon_mode, text),
  close_campaign(uuid)
  to authenticated;
