# Bilješka za nastavak rada

Stanje na 2026-10-05. Namijenjeno novoj sesiji (npr. Claude Code na računalu) koja nema kontekst razgovora u kojem je projekt nastao.

## Što je ovo
Dvosmjerna platforma za HR/SEE tržište: brendovi objavljuju testne kampanje (popust 50–100 % ili besplatan proizvod), testeri nabave proizvod i pošalju recenziju s fotografijama. Monetizacija: pretplata za brendove + naplata po odobrenoj recenziji. Cilj MVP-a: pilot s 3 stvarna brenda.

## Gdje što živi
- Kod: GitHub `tehneos/ugc-review-platform`, grana `main`; svaki push se automatski objavljuje.
- Aplikacija: https://probaj.vercel.app (stara adresa ugc-review-platform.vercel.app i dalje radi; Vercel projekt `ugc-review-platform`, funkcije u `fra1`).
- Baza: Supabase projekt `ugc-review-platform` (ref `xeeijpdxyoadrxrnhblw`, Frankfurt, besplatni plan).
- Naziv u sučelju je "Probaj" (`lib/i18n/hr.ts`, `appName`).

## Arhitektonska pravila (drži ih se)
1. **Sva poslovna pravila su u bazi**, u `security definer` funkcijama (`supabase/migrations`). Next.js server actioni samo prosljeđuju unos i prikazuju kod greške (npr. `INVALID_STATUS`).
2. **Klijent ne piše u tablice**, osim: vlastiti profil (bezopasna polja), osnovna polja brenda, widgeti. Aplikacija zato ne koristi service ključ.
3. **`select *` ne prolazi** nad `brands` i `campaigns` (column-level grant); novi stupac u `campaigns` treba `grant select (...)`.
4. **Recenzija se ne može odbiti zbog ocjene**, samo uz razlog s popisa. Oznaka da je proizvod dobiven uz popust je obavezna (widget, kopirani tekst).
5. Sav tekst sučelja je u `lib/i18n/hr.ts`; URL-ovi su na hrvatskom.
6. Next.js 16: `proxy.ts` umjesto `middleware.ts`; prije pisanja koda pročitaj `AGENTS.md`.

## Tijek narudžbe
`claimed → purchase_submitted → purchase_verified → review_submitted → completed` (+ `expired`, `cancelled`, `rejected`).
- Kupon: tester kupuje, šalje dokaz, brend potvrđuje. Dostava: brend označi poslano, tester potvrdi primitak (automatski nakon 7 dana).
- Rok za recenziju (10 dana) teče od potvrde kupnje ili primitka. Propušten rok: −30 bodova i suspenzija 30 dana.
- Odbijena recenzija smije se ispraviti jednom; drugo odbijanje je konačno (−10). Bez moderacije 5 dana: automatsko odobrenje.
- Bodovi: +5 pri odobrenju; uz poveznicu za recenziju na webshopu brenda +2 pri odobrenju i +3 kad brend potvrdi kopiju.
- Cron svaki sat: `run_hourly_maintenance()`.

## Što je testirano
- Funkcije u bazi: testirane SQL skriptama u transakciji s poništavanjem (sretni put i odbijanja).
- Sučelje: ručno ga je prošao vlasnik (registracija, kampanja, zauzimanje mjesta, dostava). Automatskih testova nema.
- Nije isprobano u pregledniku: forma recenzije s fotografijama do kraja, moderacija, widget sa stvarnim recenzijama, kopija na webshop, admin panel.

## Poznate zamke
- Supabase alat za migracije otkazuje upite s `DROP` i `DELETE`. Zato postoji `claim_campaign_slot` uz staru `claim_slot` (kojoj je oduzeto pravo izvršavanja), a zamijenjene fotografije dobivaju `removed_at` umjesto brisanja.
- Funkcije s `search_path = public` ne vide `pgcrypto`; `create_campaign` zato ima `public, extensions`.
- Ekstenzija `citext` je još u shemi `public` (upozorenje savjetnika); premještanje može promijeniti usporedbe, treba test.
- Admin se dodjeljuje ručno: `update profiles set role = 'admin' where email = '...'`.

## Što nedostaje do pilota
1. E-mail podsjetnici (Resend + n8n ili cron): čeka API ključ i domenu.
2. Stripe: pretplata, krediti, naplata po recenziji; čeka odluku o cijenama. Objava kampanje zasad ne provjerava ništa od toga.
3. Izvoz recenzija u CSV / sinkronizacija s webshopom.
4. Pravni tekstovi (uvjeti, privatnost) i pregled odvjetnika; vlastita domena.
5. Automatski testovi (Playwright) i praćenje grešaka.
6. shadcn/ui nije postavljen; sučelje je čisti Tailwind.
