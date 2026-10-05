import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireBrandMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/format";
import { t } from "@/lib/i18n/hr";
import { importCoupons, setCampaignStatus, setReviewUrl } from "../actions";

export default async function CampaignDetailPage({ params, searchParams }: PageProps<"/dashboard/kampanje/[id]">) {
  const { brand } = await requireBrandMember();
  if (!brand) redirect("/dashboard/onboarding");
  const { id } = await params;
  const sp = await searchParams;
  const d = t.campaigns.detail;

  const supabase = await createClient();
  const { data: c } = await supabase
    .from("campaigns")
    .select("id, slug, title, product_name, product_price, currency, discount_percent, status, slots_total, slots_taken, fulfillment_mode, coupon_mode, external_review_url")
    .eq("id", id)
    .eq("brand_id", brand.id)
    .maybeSingle();
  if (!c) notFound();

  const usesUniqueCoupons = c.fulfillment_mode === "coupon_purchase" && c.coupon_mode === "unique";
  let total = 0;
  let free = 0;
  if (usesUniqueCoupons) {
    const base = () => supabase.from("campaign_coupons").select("id", { count: "exact", head: true }).eq("campaign_id", c.id);
    const [all, unassigned] = await Promise.all([base(), base().is("order_id", null)]);
    total = all.count ?? 0;
    free = unassigned.count ?? 0;
  }
  const missing = usesUniqueCoupons ? Math.max(0, c.slots_total - c.slots_taken - free) : 0;
  const errorKey = typeof sp.greska === "string" ? sp.greska : null;

  return (
    <div className="max-w-2xl">
      <Link href="/dashboard/kampanje" className="text-sm font-medium text-brand">← {d.back}</Link>
      <h1 className="mt-2 text-2xl font-bold">{c.title}</h1>
      <p className="mt-1 text-sm text-stone-600">
        {c.product_name} · {money(Number(c.product_price), c.currency)} · −{c.discount_percent} % ·{" "}
        {t.campaigns.status[c.status]} · {t.campaigns.slots(c.slots_taken, c.slots_total)}
      </p>

      {errorKey && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {t.campaigns.errors[errorKey] ?? t.auth.errors.generic}
        </p>
      )}
      {sp.objavljeno && <p role="status" className="mt-4 rounded-lg bg-teal-50 p-3 text-sm text-teal-900">{d.published}</p>}
      {typeof sp.uvezeno === "string" && (
        <p role="status" className="mt-4 rounded-lg bg-teal-50 p-3 text-sm text-teal-900">{d.imported(Number(sp.uvezeno) || 0)}</p>
      )}

      {c.status === "draft" && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{d.draftNotice}</p>
      )}

      <section className="card mt-6">
        <h2 className="font-semibold">{d.coupons}</h2>
        {!usesUniqueCoupons ? (
          <p className="mt-2 text-sm text-stone-600">{c.fulfillment_mode === "brand_ships" ? d.noCoupons : d.sharedCoupon}</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-stone-600">{d.couponsCount(free, total)}</p>
            {missing > 0 && <p className="mt-1 text-sm font-medium text-amber-800">{d.couponsNeeded(missing)}</p>}
            <form action={importCoupons} className="mt-4 space-y-3">
              <input type="hidden" name="campaign_id" value={c.id} />
              <label className="label" htmlFor="codes">{d.importLabel}</label>
              <textarea className="input py-2 font-mono text-sm" id="codes" name="codes" rows={6} required />
              <button className="btn-ghost">{d.import}</button>
            </form>
          </>
        )}
      </section>

      <section className="card mt-6">
        <h2 className="font-semibold">{d.externalTitle}</h2>
        {sp.poveznica && <p role="status" className="mt-2 text-sm text-teal-900">{d.externalSaved}</p>}
        <form action={setReviewUrl} className="mt-3 space-y-3">
          <input type="hidden" name="campaign_id" value={c.id} />
          <label className="label" htmlFor="external_review_url">{t.campaigns.form.external_review_url}</label>
          <input className="input" id="external_review_url" name="external_review_url" type="url" placeholder="https://" defaultValue={c.external_review_url ?? ""} aria-describedby="ext-hint" />
          <p id="ext-hint" className="text-xs text-stone-500">{t.campaigns.form.externalHint}</p>
          <button className="btn-ghost">{d.externalSave}</button>
        </form>
      </section>

      <form action={setCampaignStatus} className="mt-6 flex flex-wrap items-center gap-3">
        <input type="hidden" name="campaign_id" value={c.id} />
        {(c.status === "draft" || c.status === "paused") && (
          <button name="intent" value="publish" className="btn">{c.status === "draft" ? d.publish : d.resume}</button>
        )}
        {c.status === "active" && (
          <>
            <button name="intent" value="pause" className="btn-ghost">{d.pause}</button>
            <Link href={`/ponude/${c.slug}`} className="text-sm font-medium text-brand">{d.publicLink}</Link>
          </>
        )}
      </form>
    </div>
  );
}
