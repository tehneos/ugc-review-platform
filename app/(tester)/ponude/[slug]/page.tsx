import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/format";
import { t } from "@/lib/i18n/hr";
import { describeTargeting, hasTargeting, matchesTargeting } from "@/lib/targeting";
import { claimSlot } from "../actions";

export default async function OfferPage({ params, searchParams }: PageProps<"/ponude/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const o = t.offer;

  const supabase = await createClient();
  const { data: c } = await supabase
    .from("campaigns")
    .select(
      "id, slug, title, description, product_name, product_url, product_image_url, product_price, currency, discount_percent, slots_total, slots_taken, review_deadline_days, min_photos, requirements, fulfillment_mode, purchase_instructions, external_review_url, status, target_gender, target_age_min, target_age_max, target_interests, brands(name)",
    )
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!c) notFound();

  const profile = await getProfile();
  let alreadyClaimed = false;
  if (profile?.role === "tester") {
    const { data: order } = await supabase
      .from("orders")
      .select("id")
      .eq("campaign_id", c.id)
      .eq("tester_id", profile.id)
      .maybeSingle();
    alreadyClaimed = !!order;
  }

  const eligible = profile?.role !== "tester" || matchesTargeting(c, profile, new Date().getFullYear());
  const brand = Array.isArray(c.brands) ? c.brands[0] : c.brands;
  const price = Number(c.product_price);
  const left = c.slots_total - c.slots_taken;
  const errorKey = typeof sp.greska === "string" ? sp.greska : null;
  const ships = c.fulfillment_mode === "brand_ships";
  const a = o.address;

  return (
    <div className="max-w-2xl">
      <Link href="/ponude" className="text-sm font-medium text-accent">← {o.back}</Link>
      <p className="mt-3 text-sm font-medium text-stone-500">{brand?.name}</p>
      <h1 className="text-2xl font-bold">{c.product_name}</h1>

      {c.product_image_url && (
        // eslint-disable-next-line @next/next/no-img-element -- slika je s domene brenda, nepoznate unaprijed
        <img src={c.product_image_url} alt={c.product_name} className="mt-4 max-h-80 w-full rounded-xl border border-stone-200 bg-white object-contain" />
      )}

      <dl className="mt-5 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <dt className="text-xs text-stone-500">{o.regularPrice}</dt>
          <dd className="mt-1 text-lg font-semibold text-stone-500 line-through">{money(price, c.currency)}</dd>
        </div>
        <div className="card p-4">
          <dt className="text-xs text-stone-500">{o.yourPrice}</dt>
          <dd className="mt-1 text-lg font-bold text-accent">
            {c.discount_percent === 100 ? t.offers.free : money(price * (1 - c.discount_percent / 100), c.currency)}
          </dd>
        </div>
      </dl>

      {c.description && <p className="mt-5 whitespace-pre-line text-stone-700">{c.description}</p>}
      <a href={c.product_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-block text-sm font-medium text-accent">
        {o.productLink} ↗
      </a>

      <section className="card mt-6">
        <h2 className="font-semibold">{o.howTitle}</h2>
        <p className="mt-2 text-sm text-stone-700">{ships ? o.modeShips : o.modeCoupon}</p>
        {c.purchase_instructions && <p className="mt-2 whitespace-pre-line text-sm text-stone-700">{c.purchase_instructions}</p>}
        {c.requirements && (
          <>
            <h3 className="mt-4 text-sm font-semibold">{o.requirements}</h3>
            <p className="mt-1 whitespace-pre-line text-sm text-stone-700">{c.requirements}</p>
          </>
        )}
        {hasTargeting(c) && <p className="mt-4 text-sm font-semibold">{t.targeting.forWhom}: {describeTargeting(c)}</p>}
        <p className="mt-4 text-sm text-stone-600">{o.rules(c.review_deadline_days, c.min_photos)}</p>
        {c.external_review_url && <p className="mt-2 text-sm text-stone-600">{o.extStep}</p>}
      </section>

      {errorKey && (
        <p role="alert" className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {o.errors[errorKey] ?? t.auth.errors.generic}
        </p>
      )}

      <div className="mt-6">
        <p className="text-sm font-medium text-stone-700">{t.offers.slotsLeft(left)}</p>
        {alreadyClaimed ? (
          <div className="mt-3">
            <p className="text-sm text-stone-700">{o.alreadyClaimed}</p>
            <Link href="/moji-testovi" className="btn mt-3">{o.seeMyTests}</Link>
          </div>
        ) : !eligible ? (
          <div className="mt-3">
            <p className="text-sm text-stone-700">{t.targeting.notEligible} {t.targeting.notEligibleIncomplete}</p>
            <Link href="/profil" className="btn-ghost mt-3">{t.targeting.completeProfile}</Link>
          </div>
        ) : left <= 0 ? (
          <p className="mt-3 text-sm text-stone-600">{o.full}</p>
        ) : !profile ? (
          <Link href={`/prijava?next=${encodeURIComponent(`/ponude/${c.slug}`)}`} className="btn mt-3">{o.loginToClaim}</Link>
        ) : profile.role !== "tester" ? (
          <p className="mt-3 text-sm text-stone-600">{o.brandCannotClaim}</p>
        ) : (
          <form action={claimSlot} className="mt-3 space-y-4">
            <input type="hidden" name="campaign_id" value={c.id} />
            <input type="hidden" name="slug" value={c.slug} />
            {ships && (
              <fieldset className="card space-y-3">
                <legend className="px-1 text-sm font-semibold">{a.title}</legend>
                <div>
                  <label className="label" htmlFor="full_name">{a.full_name}</label>
                  <input className="input" id="full_name" name="full_name" autoComplete="name" required defaultValue={profile.full_name ?? ""} />
                </div>
                <div>
                  <label className="label" htmlFor="street">{a.street}</label>
                  <input className="input" id="street" name="street" autoComplete="street-address" required />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label" htmlFor="postal_code">{a.postal_code}</label>
                    <input className="input" id="postal_code" name="postal_code" autoComplete="postal-code" inputMode="numeric" required />
                  </div>
                  <div className="col-span-2">
                    <label className="label" htmlFor="city">{a.city}</label>
                    <input className="input" id="city" name="city" autoComplete="address-level2" required />
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="phone">{a.phone}</label>
                  <input className="input" id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={profile.phone ?? ""} />
                </div>
              </fieldset>
            )}
            <button className="btn">{o.claim}</button>
          </form>
        )}
      </div>
    </div>
  );
}
