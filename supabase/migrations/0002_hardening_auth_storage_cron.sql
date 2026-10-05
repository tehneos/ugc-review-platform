-- =====================================================================
-- 0002: sigurnosno učvršćivanje, auth trigger, storage, cron
-- =====================================================================

-- ---------- 1. Pisanje iz klijenta: zatvoreno osim izričito dopuštenog
-- Sve izmjene stanja idu kroz server (service_role) ili claim_slot().
drop policy reviews_tester_insert      on reviews;       -- tester je mogao upisati status 'approved'
drop policy review_media_tester_insert on review_media;
drop policy campaigns_member_write     on campaigns;     -- brend je mogao mijenjati slots_taken / status

revoke insert, update, delete on all tables in schema public from anon, authenticated;

-- profil: korisnik mijenja samo bezopasna polja (ne role, status, trust_score, country_code)
grant update (full_name, display_name, phone, locale, avatar_url,
              whatsapp_opt_in, terms_accepted_at, media_consent_at)
  on profiles to authenticated;

-- brend: javno su vidljiva samo izložbena polja (ne Stripe ID-jevi, krediti, OIB)
revoke select on brands from anon, authenticated;
grant select (id, name, slug, logo_url, website_url, description, country_code, created_at)
  on brands to anon, authenticated;
grant update (name, logo_url, website_url, description)
  on brands to authenticated;

-- kampanja: sve osim shared_coupon_code (kupon se dobiva tek kroz claim_slot)
revoke select on campaigns from anon, authenticated;
grant select (id, brand_id, shop_connection_id, title, slug, description,
              product_name, product_url, product_external_id, product_image_url,
              product_price, country_code, currency, reward_type, discount_percent,
              coupon_mode, slots_total, slots_taken, purchase_deadline_days,
              review_deadline_days, min_photos, min_trust_score, requirements,
              fulfillment_mode, purchase_instructions, status, starts_at, ends_at,
              created_at, updated_at)
  on campaigns to anon, authenticated;

-- widgeti: članovi brenda upravljaju izravno (politika widgets_member_all)
grant insert, update, delete on widgets to authenticated;

-- tržišta: javno čitanje
alter table markets enable row level security;
create policy markets_public_read on markets for select using (true);

-- ---------- 2. Funkcije
alter function set_updated_at() set search_path = '';
revoke execute on function expire_overdue_orders() from public, anon, authenticated;
revoke execute on function claim_slot(uuid) from public, anon;
grant  execute on function claim_slot(uuid) to authenticated;

-- ---------- 3. Profil se stvara automatski pri registraciji
-- Uloga iz metapodataka smije biti samo 'tester' ili 'brand'; admin se dodjeljuje ručno.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role    user_role;
  v_country char(2);
begin
  v_role := case when new.raw_user_meta_data->>'role' = 'brand'
                 then 'brand'::user_role else 'tester'::user_role end;
  v_country := upper(coalesce(new.raw_user_meta_data->>'country_code', 'HR'));
  if not exists (select 1 from markets where country_code = v_country) then
    v_country := 'HR';
  end if;

  insert into profiles (id, email, role, full_name, country_code, locale)
  values (new.id, new.email, v_role, new.raw_user_meta_data->>'full_name', v_country,
          (select default_locale from markets where country_code = v_country));
  return new;
end $$;
revoke execute on function handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- 4. Storage
-- review-media: javni bucket (widget prikazuje slike), putanja = {user_id}/{uuid}.jpg
-- purchase-proofs: privatni; brend vidi dokaz samo preko potpisanog URL-a sa servera
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('review-media', 'review-media', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('purchase-proofs', 'purchase-proofs', false, 5242880,
   array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

create policy review_media_upload_own on storage.objects for insert to authenticated
  with check (bucket_id = 'review-media'
              and (storage.foldername(name))[1] = auth.uid()::text);

create policy purchase_proofs_upload_own on storage.objects for insert to authenticated
  with check (bucket_id = 'purchase-proofs'
              and (storage.foldername(name))[1] = auth.uid()::text);

create policy purchase_proofs_read_own on storage.objects for select to authenticated
  using (bucket_id = 'purchase-proofs'
         and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- 5. Cron (svaki sat)
create extension if not exists pg_cron;

select cron.schedule('expire-overdue-orders', '5 * * * *',
  $$select public.expire_overdue_orders()$$);

select cron.schedule('lift-expired-suspensions', '10 * * * *',
  $$update public.profiles
       set status = 'active', suspended_until = null
     where status = 'suspended' and suspended_until < now()$$);
