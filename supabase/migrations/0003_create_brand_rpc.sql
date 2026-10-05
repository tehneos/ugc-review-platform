-- Onboarding brenda: klijent ne smije pisati u brands, pa ide kroz funkciju.
create or replace function create_brand(
  p_name text, p_slug text, p_website_url text default null, p_description text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user    uuid := auth.uid();
  v_profile profiles;
  v_brand   uuid;
begin
  select * into v_profile from profiles where id = v_user;
  if v_profile.id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if v_profile.role <> 'brand' then raise exception 'NOT_A_BRAND_ACCOUNT'; end if;
  if exists (select 1 from brands where owner_id = v_user) then
    raise exception 'BRAND_ALREADY_EXISTS';
  end if;
  if char_length(trim(p_name)) < 2 then raise exception 'INVALID_NAME'; end if;
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_slug) not between 2 and 60 then
    raise exception 'INVALID_SLUG';
  end if;
  if exists (select 1 from brands where slug = p_slug) then
    raise exception 'SLUG_TAKEN';
  end if;

  insert into brands (owner_id, name, slug, website_url, description, country_code)
  values (v_user, trim(p_name), p_slug, nullif(trim(p_website_url), ''),
          nullif(trim(p_description), ''), v_profile.country_code)
  returning id into v_brand;

  insert into brand_members (brand_id, user_id, role) values (v_brand, v_user, 'owner');
  return v_brand;
end $$;

revoke execute on function create_brand(text, text, text, text) from public, anon;
grant  execute on function create_brand(text, text, text, text) to authenticated;
