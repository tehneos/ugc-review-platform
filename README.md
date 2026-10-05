# UGC & Review platforma

Dvosmjerna platforma za HR/SEE tržište: brendovi objavljuju testne kampanje, testeri šalju recenzije s fotografijama.

## Stack
Next.js 16 (App Router, `proxy.ts`) · Tailwind 4 · Supabase (Postgres + RLS, Auth, Storage, pg_cron)

## Pokretanje
```bash
cp .env.example .env.local   # upiši publishable ključ iz Supabasea
npm install
npm run dev
```

## Struktura
- `app/(auth)` – prijava, registracija
- `app/(tester)` – ponude, moji testovi, profil
- `app/(brand)/dashboard` – dashboard brenda, onboarding
- `lib/supabase` – klijenti; `lib/auth.ts` – zaštita po ulozi; `lib/i18n/hr.ts` – sav tekst
- `supabase/migrations` – shema baze (primijenjena na projekt `ugc-review-platform`)

## Pravila
- Klijent ne piše izravno u bazu, osim u vlastiti profil, osnovna polja brenda i widgete. Sve ostalo ide kroz funkcije u bazi (`claim_slot`, `create_brand`) ili server.
- Upiti nad `brands` i `campaigns` moraju navesti stupce (`select *` ne prolazi).
