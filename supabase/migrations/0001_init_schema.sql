-- =====================================================================
-- UGC & Review platforma — inicijalna shema (Supabase / PostgreSQL)
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ---------- ENUMI ----------------------------------------------------
create type user_role          as enum ('tester', 'brand', 'admin');
create type tester_status      as enum ('active', 'suspended', 'banned');
create type brand_member_role  as enum ('owner', 'admin', 'moderator');
create type shop_platform      as enum ('shopify', 'woocommerce', 'custom');
create type campaign_status    as enum ('draft', 'active', 'paused', 'completed', 'cancelled');
create type reward_type        as enum ('discount_percent', 'free_product');
create type coupon_mode        as enum ('shared', 'unique');
create type fulfillment_mode   as enum (
  'coupon_purchase',  -- tester kupuje bilo gdje (webshop, marketplace, dućan) uz kupon/popust
  'brand_ships',      -- brend šalje proizvod testeru na adresu
  'refund'            -- tester plaća punu cijenu, brend vraća novac nakon recenzije
);
create type order_status       as enum (
  'claimed',             -- tester zauzeo mjesto, čeka se kupnja
  'purchase_submitted',  -- poslan dokaz o kupnji
  'purchase_verified',   -- kupnja potvrđena (API ili ručno), teče rok za recenziju
  'review_submitted',    -- recenzija čeka moderaciju
  'completed',           -- recenzija odobrena
  'expired',             -- istekao rok
  'cancelled',           -- tester odustao
  'rejected'             -- dokaz o kupnji odbijen
);
create type verification_method as enum ('api', 'manual');
create type review_status      as enum ('pending', 'approved', 'rejected', 'flagged');
create type rejection_reason   as enum (
  'wrong_product', 'low_quality_photo', 'offensive_content',
  'not_genuine', 'missing_photo', 'other'
);
create type widget_type        as enum ('carousel', 'grid', 'badge', 'product_reviews');
create type notification_channel as enum ('email', 'whatsapp', 'in_app');

-- ---------- updated_at helper ---------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- MARKETS --------------------------------------------------
-- Regija je podržana od početka; lansiranje se pali po tržištu preko is_live.
create table markets (
  country_code char(2) primary key,
  currency     char(3) not null,
  default_locale text not null,
  is_live      boolean not null default false
);
insert into markets (country_code, currency, default_locale, is_live) values
  ('HR', 'EUR', 'hr', true),
  ('SI', 'EUR', 'sl', false),
  ('BA', 'BAM', 'bs', false),
  ('RS', 'RSD', 'sr', false);

-- ---------- PROFILES (users) ----------------------------------------
-- Proširenje auth.users; jedan red po korisniku.
create table profiles (
  id                      uuid primary key references auth.users(id) on delete cascade,
  role                    user_role not null default 'tester',
  email                   citext not null unique,
  full_name               text,
  display_name            text,                 -- javno ime na recenziji ("Ana M.")
  phone                   text,
  country_code            char(2) not null default 'HR' references markets(country_code),
  locale                  text not null default 'hr',
  avatar_url              text,
  -- sustav povjerenja
  status                  tester_status not null default 'active',
  trust_score             int not null default 100 check (trust_score between 0 and 100),
  completed_reviews_count int not null default 0,
  missed_deadlines_count  int not null default 0,
  suspended_until         timestamptz,
  -- privole (GDPR)
  terms_accepted_at       timestamptz,
  media_consent_at        timestamptz,          -- privola za javnu objavu fotografija
  whatsapp_opt_in         boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();

-- ---------- BRANDS ---------------------------------------------------
create table brands (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null references profiles(id) on delete restrict,
  name                  text not null,
  slug                  citext not null unique,
  logo_url              text,
  website_url           text,
  description           text,
  country_code          char(2) not null default 'HR' references markets(country_code),
  vat_id                text,                   -- OIB / PDV ID
  -- naplata (Stripe)
  stripe_customer_id      text unique,
  stripe_subscription_id  text unique,
  plan                    text not null default 'free',
  subscription_status     text not null default 'inactive',
  current_period_end      timestamptz,
  review_credits          int not null default 0 check (review_credits >= 0),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create trigger trg_brands_updated before update on brands
  for each row execute function set_updated_at();

create table brand_members (
  brand_id   uuid not null references brands(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  role       brand_member_role not null default 'moderator',
  created_at timestamptz not null default now(),
  primary key (brand_id, user_id)
);
create index idx_brand_members_user on brand_members(user_id);

-- ---------- SHOP CONNECTIONS ----------------------------------------
-- Tokene NE držati u čistom tekstu: spremiti u Supabase Vault, ovdje samo ID tajne.
create table shop_connections (
  id                 uuid primary key default gen_random_uuid(),
  brand_id           uuid not null references brands(id) on delete cascade,
  platform           shop_platform not null,
  shop_domain        citext not null,
  access_token_secret_id uuid,                  -- referenca na vault.secrets
  webhook_secret_id  uuid,
  scopes             text[],
  is_active          boolean not null default true,
  last_synced_at     timestamptz,
  created_at         timestamptz not null default now(),
  unique (platform, shop_domain)
);
create index idx_shop_connections_brand on shop_connections(brand_id);

-- ---------- CAMPAIGNS ------------------------------------------------
create table campaigns (
  id                    uuid primary key default gen_random_uuid(),
  brand_id              uuid not null references brands(id) on delete cascade,
  shop_connection_id    uuid references shop_connections(id) on delete set null,
  title                 text not null,
  slug                  citext not null unique,
  description           text,
  -- proizvod
  product_name          text not null,
  product_url           text not null,
  product_external_id   text,                   -- Shopify/Woo product ID
  product_image_url     text,
  product_price         numeric(10,2) not null check (product_price >= 0),
  country_code          char(2) not null default 'HR' references markets(country_code),
  currency              char(3) not null default 'EUR' check (currency in ('EUR', 'BAM', 'RSD')),
  -- nagrada
  reward_type           reward_type not null default 'discount_percent',
  discount_percent      int not null check (discount_percent between 50 and 100),
  coupon_mode           coupon_mode not null default 'unique',
  shared_coupon_code    text,
  -- kapacitet i rokovi
  slots_total           int not null check (slots_total > 0),
  slots_taken           int not null default 0,
  purchase_deadline_days int not null default 3  check (purchase_deadline_days > 0),
  review_deadline_days   int not null default 10 check (review_deadline_days > 0),
  min_photos            int not null default 1 check (min_photos between 1 and 3),
  min_trust_score       int not null default 0,
  requirements          text,                   -- upute testeru
  fulfillment_mode      fulfillment_mode not null default 'coupon_purchase',
  purchase_instructions text,                   -- gdje i kako doći do proizvoda (slobodan tekst)
  status                campaign_status not null default 'draft',
  starts_at             timestamptz,
  ends_at               timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (slots_taken between 0 and slots_total),
  check (fulfillment_mode <> 'coupon_purchase' or coupon_mode <> 'shared'
         or shared_coupon_code is not null)
);
create trigger trg_campaigns_updated before update on campaigns
  for each row execute function set_updated_at();
create index idx_campaigns_brand on campaigns(brand_id);
create index idx_campaigns_marketplace on campaigns(status, ends_at) where status = 'active';

-- ---------- ORDERS (zauzeto mjesto + dokaz kupnje) -------------------
create table orders (
  id                    uuid primary key default gen_random_uuid(),
  campaign_id           uuid not null references campaigns(id) on delete restrict,
  brand_id              uuid not null references brands(id) on delete restrict,
  tester_id             uuid not null references profiles(id) on delete restrict,
  status                order_status not null default 'claimed',
  coupon_code           text,
  -- dokaz o kupnji
  external_order_number text,
  proof_file_path       text,                   -- Storage: bucket "purchase-proofs" (privatni)
  verification_method   verification_method,
  purchase_verified_at  timestamptz,
  verified_by           uuid references profiles(id),
  rejection_note        text,
  -- dostava (fulfillment_mode = 'brand_ships'); adresa je snimka u trenutku prijave
  shipping_address      jsonb,
  tracking_number       text,
  shipped_at            timestamptz,
  received_at           timestamptz,            -- tester potvrdio primitak
  -- rokovi
  claimed_at            timestamptz not null default now(),
  purchase_due_at       timestamptz not null,
  review_due_at         timestamptz,            -- postavlja se pri verifikaciji kupnje
  completed_at          timestamptz,
  updated_at            timestamptz not null default now(),
  unique (campaign_id, tester_id)               -- jedan tester = jedno mjesto po kampanji
);
create trigger trg_orders_updated before update on orders
  for each row execute function set_updated_at();
create index idx_orders_tester on orders(tester_id, status);
create index idx_orders_brand on orders(brand_id, status);
create index idx_orders_review_due on orders(review_due_at) where status = 'purchase_verified';
create index idx_orders_purchase_due on orders(purchase_due_at) where status = 'claimed';
create unique index idx_orders_external_number
  on orders(brand_id, external_order_number) where external_order_number is not null;

-- Jedinstveni kuponi po kampanji (coupon_mode = 'unique')
create table campaign_coupons (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  code        text not null,
  order_id    uuid unique references orders(id) on delete set null,
  assigned_at timestamptz,
  unique (campaign_id, code)
);
create index idx_coupons_free on campaign_coupons(campaign_id) where order_id is null;

-- ---------- REVIEWS --------------------------------------------------
create table reviews (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null unique references orders(id) on delete restrict,
  campaign_id      uuid not null references campaigns(id) on delete restrict,
  brand_id         uuid not null references brands(id) on delete restrict,
  tester_id        uuid not null references profiles(id) on delete restrict,
  rating           smallint not null check (rating between 1 and 5),
  title            text,
  body             text not null check (char_length(body) >= 30),
  display_name     text not null,
  is_incentivized  boolean not null default true,   -- obavezna oznaka u widgetu
  status           review_status not null default 'pending',
  rejection_reason rejection_reason,
  rejection_note   text,
  moderated_by     uuid references profiles(id),
  moderated_at     timestamptz,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (status <> 'rejected' or rejection_reason is not null)
);
create trigger trg_reviews_updated before update on reviews
  for each row execute function set_updated_at();
create index idx_reviews_brand_status on reviews(brand_id, status);
create index idx_reviews_widget on reviews(brand_id, campaign_id, published_at desc)
  where status = 'approved';

create table review_media (
  id           uuid primary key default gen_random_uuid(),
  review_id    uuid not null references reviews(id) on delete cascade,
  storage_path text not null,                   -- Storage: bucket "review-media"
  width        int,
  height       int,
  position     smallint not null default 0 check (position between 0 and 2),
  created_at   timestamptz not null default now(),
  unique (review_id, position)                  -- max 3 fotografije
);

-- ---------- WIDGETS --------------------------------------------------
create table widgets (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  campaign_id     uuid references campaigns(id) on delete set null,  -- null = sve kampanje brenda
  name            text not null,
  type            widget_type not null default 'carousel',
  public_key      text not null unique default encode(gen_random_bytes(16), 'hex'),
  allowed_domains text[] not null default '{}',
  config          jsonb not null default '{}'::jsonb,  -- boje, layout, min_rating, limit, jezik
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_widgets_updated before update on widgets
  for each row execute function set_updated_at();
create index idx_widgets_brand on widgets(brand_id);

-- ---------- POMOĆNE TABLICE ------------------------------------------
-- Dnevnik promjena trust scorea (revizijski trag)
create table trust_events (
  id         bigint generated always as identity primary key,
  tester_id  uuid not null references profiles(id) on delete cascade,
  order_id   uuid references orders(id) on delete set null,
  event_type text not null,       -- review_approved | deadline_missed | review_rejected | manual
  delta      int not null,
  note       text,
  created_at timestamptz not null default now()
);
create index idx_trust_events_tester on trust_events(tester_id, created_at desc);

-- Poslani podsjetnici; unique ključ sprječava dvostruko slanje iz n8n-a
create table notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references profiles(id) on delete cascade,
  order_id   uuid references orders(id) on delete cascade,
  channel    notification_channel not null,
  template   text not null,       -- review_due_3d | review_due_1d | purchase_due_1d | suspended ...
  sent_at    timestamptz not null default now(),
  provider_message_id text,
  unique (order_id, template, channel)
);

-- Naplata po verificiranoj recenziji; unique(review_id) = recenzija se naplaćuje jednom
create table billing_events (
  id                bigint generated always as identity primary key,
  brand_id          uuid not null references brands(id) on delete restrict,
  review_id         uuid unique references reviews(id) on delete set null,
  event_type        text not null,   -- review_charge | credit_topup | subscription
  credits_delta     int not null default 0,
  amount_cents      int,
  currency          char(3) not null default 'EUR',
  stripe_event_id   text unique,
  created_at        timestamptz not null default now()
);
create index idx_billing_brand on billing_events(brand_id, created_at desc);

-- =====================================================================
-- POSLOVNA LOGIKA
-- =====================================================================

-- Atomsko zauzimanje mjesta (bez race conditiona pri zadnjem slobodnom mjestu)
create or replace function claim_slot(p_campaign_id uuid)
returns orders
language plpgsql security definer set search_path = public as $$
declare
  v_user    uuid := auth.uid();
  v_profile profiles;
  v_camp    campaigns;
  v_order   orders;
  v_coupon  text;
begin
  select * into v_profile from profiles where id = v_user;
  if v_profile.id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if v_profile.status <> 'active' then raise exception 'ACCOUNT_SUSPENDED'; end if;

  update campaigns
     set slots_taken = slots_taken + 1
   where id = p_campaign_id
     and status = 'active'
     and slots_taken < slots_total
     and (ends_at is null or ends_at > now())
     and min_trust_score <= v_profile.trust_score
     and country_code = v_profile.country_code   -- samo domaća dostava, bez carine
     and exists (select 1 from markets m
                  where m.country_code = campaigns.country_code and m.is_live)
  returning * into v_camp;
  if v_camp.id is null then raise exception 'CAMPAIGN_UNAVAILABLE'; end if;

  insert into orders (campaign_id, brand_id, tester_id, purchase_due_at)
  values (v_camp.id, v_camp.brand_id, v_user,
          now() + make_interval(days => v_camp.purchase_deadline_days))
  returning * into v_order;   -- unique(campaign_id, tester_id) ruši duplu prijavu

  if v_camp.fulfillment_mode <> 'coupon_purchase' then
    return v_order;   -- bez kupona: brend šalje proizvod ili vraća novac
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

-- Istek rokova + suspenzija; pokreće pg_cron ili n8n jednom na sat
create or replace function expire_overdue_orders()
returns int
language plpgsql security definer set search_path = public as $$
declare v_count int := 0; r record;
begin
  -- nije kupio na vrijeme: mjesto se oslobađa, bez kazne suspenzijom
  for r in
    update orders set status = 'expired'
     where status = 'claimed' and purchase_due_at < now()
    returning id, campaign_id, tester_id
  loop
    update campaigns set slots_taken = slots_taken - 1 where id = r.campaign_id;
    update campaign_coupons set order_id = null, assigned_at = null where order_id = r.id;
    insert into trust_events (tester_id, order_id, event_type, delta)
    values (r.tester_id, r.id, 'purchase_missed', -5);
    update profiles set trust_score = greatest(trust_score - 5, 0) where id = r.tester_id;
    v_count := v_count + 1;
  end loop;

  -- kupio, a nije poslao recenziju: suspenzija
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

-- =====================================================================
-- ROW LEVEL SECURITY (osnovne politike)
-- =====================================================================
create or replace function is_brand_member(p_brand_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from brand_members
                  where brand_id = p_brand_id and user_id = auth.uid());
$$;

alter table profiles         enable row level security;
alter table brands           enable row level security;
alter table brand_members    enable row level security;
alter table shop_connections enable row level security;
alter table campaigns        enable row level security;
alter table campaign_coupons enable row level security;
alter table orders           enable row level security;
alter table reviews          enable row level security;
alter table review_media     enable row level security;
alter table widgets          enable row level security;
alter table trust_events     enable row level security;
alter table notifications    enable row level security;
alter table billing_events   enable row level security;
-- Tablice bez politika (campaign_coupons, notifications, billing_events, shop_connections pisanje)
-- dostupne su samo service_role ključu, tj. serverskom kodu.

create policy profiles_self_read   on profiles for select using (id = auth.uid());
create policy profiles_self_update on profiles for update using (id = auth.uid());
-- NAPOMENA: role, status i trust_score zaštititi column-level grantom ili triggerom,
-- da ih korisnik ne može sam mijenjati.

create policy brands_public_read on brands for select using (true);
create policy brands_member_update on brands for update using (is_brand_member(id));

create policy members_read on brand_members for select
  using (user_id = auth.uid() or is_brand_member(brand_id));

create policy shop_conn_member_read on shop_connections for select
  using (is_brand_member(brand_id));

create policy campaigns_public_read on campaigns for select
  using (status in ('active', 'completed') or is_brand_member(brand_id));
create policy campaigns_member_write on campaigns for all
  using (is_brand_member(brand_id)) with check (is_brand_member(brand_id));

create policy orders_read on orders for select
  using (tester_id = auth.uid() or is_brand_member(brand_id));
-- Upis/izmjena narudžbi ide isključivo kroz claim_slot() i serverske rute.

create policy reviews_read on reviews for select
  using (status = 'approved' or tester_id = auth.uid() or is_brand_member(brand_id));
create policy reviews_tester_insert on reviews for insert
  with check (tester_id = auth.uid());

create policy review_media_read on review_media for select
  using (exists (select 1 from reviews r where r.id = review_id
                 and (r.status = 'approved' or r.tester_id = auth.uid()
                      or is_brand_member(r.brand_id))));
create policy review_media_tester_insert on review_media for insert
  with check (exists (select 1 from reviews r
                      where r.id = review_id and r.tester_id = auth.uid()));

create policy widgets_member_all on widgets for all
  using (is_brand_member(brand_id)) with check (is_brand_member(brand_id));

create policy trust_events_self_read on trust_events for select
  using (tester_id = auth.uid());
