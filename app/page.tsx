import Link from "next/link";
import { OFFER_COLUMNS, OfferCard, type Offer } from "@/components/offer-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Stars } from "@/components/stars";
import { money, reviewPhotoUrl } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/hr";

type Media = { storage_path: string; position: number; removed_at: string | null };

/** Ilustracija toka u heroju: nacrtano sučelje, bez izmišljenih osoba i citata. */
function HeroArt() {
  const h = t.landing.art;
  return (
    <div aria-hidden className="relative mx-auto h-[340px] w-full max-w-md sm:h-[400px]">
      <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-tint via-white to-tint-2" />
      <div className="absolute top-8 left-6 w-52 rotate-[-5deg] rounded-2xl border border-stone-200 bg-white p-3 shadow-xl sm:w-60">
        <div className="relative aspect-[4/3] rounded-xl bg-gradient-to-br from-brand/20 to-tint-2">
          <span className="absolute top-2 left-2 rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-bold text-white">−70 %</span>
        </div>
        <div className="mt-3 h-2.5 w-3/4 rounded-full bg-ink/15" />
        <div className="mt-2 h-2.5 w-1/2 rounded-full bg-ink/10" />
        <div className="mt-3 rounded-full bg-brand py-1.5 text-center text-[11px] font-bold text-white">{h.claim}</div>
      </div>
      <div className="absolute right-4 bottom-8 w-52 rotate-[4deg] rounded-2xl border border-stone-200 bg-white p-4 shadow-xl sm:w-60">
        <p className="text-lg tracking-wide text-amber-500">★★★★★</p>
        <div className="mt-2 h-2.5 w-full rounded-full bg-ink/15" />
        <div className="mt-2 h-2.5 w-5/6 rounded-full bg-ink/10" />
        <div className="mt-2 h-2.5 w-2/3 rounded-full bg-ink/10" />
        <div className="mt-3 flex gap-2">
          <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-tint-2 to-brand/25" />
          <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-brand/20 to-tint" />
        </div>
        <p className="mt-3 inline-block rounded-full bg-tint-2 px-2.5 py-1 text-[10px] font-semibold text-ink/70">{h.badge}</p>
      </div>
    </div>
  );
}

export default async function LandingPage() {
  const l = t.landing;
  const supabase = await createClient();
  const [{ data: offers }, { data: reviews }] = await Promise.all([
    supabase.from("campaigns").select(OFFER_COLUMNS).eq("status", "active").eq("country_code", "HR").order("created_at", { ascending: false }).limit(6),
    supabase
      .from("reviews")
      .select("id, rating, title, body, display_name, campaigns(product_name), brands(name), review_media(storage_path, position, removed_at)")
      .eq("status", "approved")
      .order("published_at", { ascending: false })
      .limit(6),
  ]);

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:py-16 lg:grid-cols-2">
          <div>
            <p className="eyebrow">{l.eyebrow}</p>
            <h1 className="mt-3 text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-6xl">{l.title}</h1>
            <p className="mt-5 max-w-lg text-lg text-ink/70">{l.subtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/registracija?uloga=tester" className="btn px-8">{l.ctaTester}</Link>
              <Link href="/ponude" className="btn-ghost px-8">{l.ctaBrowse}</Link>
            </div>
            <p className="mt-4 text-sm text-ink/55">{l.free}</p>
          </div>
          <HeroArt />
        </section>

        {!!offers?.length && (
          <section className="mx-auto max-w-6xl px-4 py-10">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow">{l.offersEyebrow}</p>
                <h2 className="section-title mt-2">{l.offersTitle}</h2>
              </div>
              <Link href="/ponude" className="inline-flex min-h-11 items-center text-sm font-bold text-brand hover:underline">{l.allOffers} →</Link>
            </div>
            <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {(offers as Offer[]).map((o) => (
                <li key={o.id}><OfferCard offer={o} /></li>
              ))}
            </ul>
          </section>
        )}

        {!offers?.length && (
          <section className="mx-auto max-w-6xl px-4 py-10">
            <p className="eyebrow">{l.soon}</p>
            <h2 className="section-title mt-2">{l.exampleOffersTitle}</h2>
            <p className="mt-2 max-w-2xl text-sm text-ink/65">{l.exampleOffersNote}</p>
            <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {l.exampleOffers.map((o) => (
                <li key={o.name} className="relative overflow-hidden rounded-2xl border border-dashed border-ink/25 bg-white">
                  <div aria-hidden className="relative flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-tint to-tint-2 text-6xl font-extrabold text-brand/25">
                    {o.name.charAt(0)}
                    <span className="absolute top-3 left-3 rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">
                      {o.discount === 100 ? t.offers.free : `−${o.discount} %`}
                    </span>
                  </div>
                  <span className="absolute top-3 right-3 rounded-full bg-ink px-3 py-1 text-xs font-bold text-white">{l.example}</span>
                  <div className="p-4">
                    <p className="text-xs font-semibold text-ink/55">{o.brand}</p>
                    <h3 className="mt-0.5 font-bold">{o.name}</h3>
                    <p className="mt-2 flex items-baseline gap-2">
                      <span className="text-lg font-extrabold">{o.discount === 100 ? t.offers.free : money(o.price * (1 - o.discount / 100), "EUR")}</span>
                      <span className="text-sm text-ink/45 line-through">{money(o.price, "EUR")}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section id="kako-radi" className="scroll-mt-20 bg-tint-2/60">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <p className="eyebrow">{l.howEyebrow}</p>
            <h2 className="section-title mt-2">{l.howTitle}</h2>
            <ol className="mt-8 grid gap-5 sm:grid-cols-3">
              {l.steps.map((s, i) => (
                <li key={s.title} className="card">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-lg font-extrabold text-white">{i + 1}</span>
                  <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-ink/70">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {!!reviews?.length && (
          <section className="mx-auto max-w-6xl px-4 py-14">
            <p className="eyebrow">{l.reviewsEyebrow}</p>
            <h2 className="section-title mt-2">{l.reviewsTitle}</h2>
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.map((r) => {
                const c = Array.isArray(r.campaigns) ? r.campaigns[0] : r.campaigns;
                const b = Array.isArray(r.brands) ? r.brands[0] : r.brands;
                const photos = (r.review_media as Media[]).filter((m) => !m.removed_at).sort((x, y) => x.position - y.position);
                return (
                  <li key={r.id} className="card flex flex-col">
                    <p className="text-xs font-semibold text-ink/55">{b?.name} · {c?.product_name}</p>
                    <p className="mt-1 text-lg"><Stars rating={r.rating} /></p>
                    {r.title && <h3 className="mt-1 font-bold">{r.title}</h3>}
                    <p className="mt-2 line-clamp-5 text-sm whitespace-pre-line text-ink/80">{r.body}</p>
                    {photos.length > 0 && (
                      <div className="mt-3 flex gap-2">
                        {photos.map((m) => (
                          // eslint-disable-next-line @next/next/no-img-element -- slike iz Supabase Storagea
                          <img key={m.storage_path} src={reviewPhotoUrl(m.storage_path)} alt={`${l.photoBy} ${r.display_name}`} loading="lazy" className="h-20 w-20 rounded-xl object-cover" />
                        ))}
                      </div>
                    )}
                    <p className="mt-auto pt-4 text-sm font-bold">{r.display_name}</p>
                    <p className="mt-1 text-[11px] text-ink/55">{l.incentivized}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {!reviews?.length && (
          <section className="mx-auto max-w-6xl px-4 py-14">
            <p className="eyebrow">{l.reviewsEyebrow}</p>
            <h2 className="section-title mt-2">{l.exampleReviewsTitle}</h2>
            <p className="mt-2 max-w-2xl text-sm text-ink/65">{l.exampleReviewsNote}</p>
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {l.exampleReviews.map((r) => (
                <li key={r.title} className="relative flex flex-col rounded-2xl border border-dashed border-ink/25 bg-white p-5">
                  <span className="absolute top-4 right-4 rounded-full bg-ink px-3 py-1 text-xs font-bold text-white">{l.example}</span>
                  <p className="text-xs font-semibold text-ink/55">{r.product}</p>
                  <p className="mt-1 text-lg"><Stars rating={r.rating} /></p>
                  <h3 className="mt-1 font-bold">{r.title}</h3>
                  <p className="mt-2 text-sm text-ink/80">{r.body}</p>
                  <div aria-hidden className="mt-3 flex gap-2">
                    <div className="h-20 w-20 rounded-xl bg-gradient-to-br from-tint-2 to-brand/25" />
                    <div className="h-20 w-20 rounded-xl bg-gradient-to-br from-brand/20 to-tint" />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section id="za-brendove" className="scroll-mt-20 px-4 py-10">
          <div className="mx-auto grid max-w-6xl gap-8 rounded-[2rem] bg-ink px-6 py-12 text-white sm:px-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-bold tracking-widest text-sky-300 uppercase">{l.brandEyebrow}</p>
              <h2 className="section-title mt-2">{l.brandTitle}</h2>
              <p className="mt-4 max-w-md text-white/75">{l.brandText}</p>
              <Link href="/registracija?uloga=brand" className="btn-light mt-7 px-8">{l.ctaBrand}</Link>
            </div>
            <ul className="space-y-4">
              {l.brandPoints.map((p) => (
                <li key={p.title} className="rounded-2xl bg-white/8 p-5 ring-1 ring-white/10">
                  <h3 className="font-bold">{p.title}</h3>
                  <p className="mt-1 text-sm text-white/70">{p.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
