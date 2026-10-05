import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireBrandMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/format";
import { t } from "@/lib/i18n/hr";
import { closeCampaign, importCoupons, setCampaignStatus, setReviewUrl, updateCampaign } from "../actions";

export default async function CampaignDetailPage({ params, searchParams }: PageProps<"/dashboard/kampanje/[id]">) {
  const { brand } = await requireBrandMember();
  if (!brand) redirect("/dashboard/onboarding");
  const { id } = await params;
  const sp = await searchParams;
  const d = t.campaigns.detail;

  const supabase = await createClient();
  const { data: c } = await supabase
    .from("campaigns")
    .select("id, slug, title, product_name, product_price, currency, discount_percent, status, slots_total, slots_taken, fulfillment_mode, coupon_mode, external_review_url, description, product_url, product_image_url, purchase_instructions, requirements, min_photos, deleted_at")
    .eq("id", id)
    .eq("brand_id", brand.id)
    .maybeSingle();
  if (!c || c.deleted_at) notFound();

  const { count: orderCount } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("campaign_id", id);
  const hasClaims = (orderCount ?? 0) > 0;
  const editable = ["draft", "active", "paused"].includes(c.status);
  const f = t.campaigns.form;

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
      {sp.uredeno && <p role="status" className="mt-4 rounded-lg bg-teal-50 p-3 text-sm text-teal-900">{d.edited}</p>}
      {sp.zatvoreno && <p role="status" className="mt-4 rounded-lg bg-teal-50 p-3 text-sm text-teal-900">{d.closed}</p>}
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

      {editable && (
        <details className="card mt-6">
          <summary className="cursor-pointer font-semibold">{d.editTitle}</summary>
          {hasClaims && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{d.lockedNote}</p>}
          <form action={updateCampaign} className="mt-4 space-y-4">
            <input type="hidden" name="campaign_id" value={c.id} />
            <div>
              <label className="label" htmlFor="e-title">{f.title}</label>
              <input className="input" id="e-title" name="title" defaultValue={c.title} required minLength={3} maxLength={120} />
            </div>
            <div>
              <label className="label" htmlFor="e-product_name">{f.product_name}</label>
              <input className="input disabled:bg-stone-100 disabled:text-ink/50" id="e-product_name" name="product_name" defaultValue={c.product_name} required maxLength={120} disabled={hasClaims} />
            </div>
            <div>
              <label className="label" htmlFor="e-product_url">{f.product_url}</label>
              <input className="input" id="e-product_url" name="product_url" type="url" defaultValue={c.product_url} required />
            </div>
            <div>
              <label className="label" htmlFor="e-product_image_url">{f.product_image_url}</label>
              <input className="input" id="e-product_image_url" name="product_image_url" type="url" defaultValue={c.product_image_url ?? ""} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="e-product_price">{f.product_price}</label>
                <input className="input disabled:bg-stone-100 disabled:text-ink/50" id="e-product_price" name="product_price" inputMode="decimal" defaultValue={String(c.product_price)} required disabled={hasClaims} />
              </div>
              <div>
                <label className="label" htmlFor="e-discount_percent">{f.discount_percent}</label>
                <input className="input disabled:bg-stone-100 disabled:text-ink/50" id="e-discount_percent" name="discount_percent" type="number" min={50} max={100} defaultValue={c.discount_percent} required disabled={hasClaims} />
              </div>
              <div>
                <label className="label" htmlFor="e-slots_total">{f.slots_total}</label>
                <input className="input" id="e-slots_total" name="slots_total" type="number" min={hasClaims ? c.slots_total : Math.max(1, c.slots_taken)} max={500} defaultValue={c.slots_total} required />
              </div>
              <div>
                <label className="label" htmlFor="e-min_photos">{f.min_photos}</label>
                <select className="input disabled:bg-stone-100 disabled:text-ink/50" id="e-min_photos" name="min_photos" defaultValue={String(c.min_photos)} disabled={hasClaims}>
                  <option>1</option><option>2</option><option>3</option>
                </select>
              </div>
            </div>
            {c.status === "draft" ? (
              <>
                <fieldset>
                  <legend className="label">{f.fulfillment}</legend>
                  <div className="space-y-2 text-sm">
                    <label className="flex items-center gap-2"><input type="radio" name="fulfillment_mode" value="coupon_purchase" defaultChecked={c.fulfillment_mode === "coupon_purchase"} /> {f.modeCoupon}</label>
                    <label className="flex items-center gap-2"><input type="radio" name="fulfillment_mode" value="brand_ships" defaultChecked={c.fulfillment_mode === "brand_ships"} /> {f.modeShips}</label>
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="label">{f.couponMode}</legend>
                  <div className="space-y-2 text-sm">
                    <label className="flex items-center gap-2"><input type="radio" name="coupon_mode" value="unique" defaultChecked={c.coupon_mode === "unique"} /> {f.couponUnique}</label>
                    <label className="flex items-center gap-2"><input type="radio" name="coupon_mode" value="shared" defaultChecked={c.coupon_mode === "shared"} /> {f.couponShared}</label>
                  </div>
                </fieldset>
              </>
            ) : (
              <p className="text-xs text-ink/55">{d.modeNote}</p>
            )}
            {c.fulfillment_mode === "coupon_purchase" && (c.coupon_mode === "shared" || c.status === "draft") && (
              <div>
                <label className="label" htmlFor="e-shared_coupon_code">{d.newSharedCode}</label>
                <input className="input" id="e-shared_coupon_code" name="shared_coupon_code" maxLength={64} />
              </div>
            )}
            <div>
              <label className="label" htmlFor="e-description">{f.description}</label>
              <textarea className="input py-2" id="e-description" name="description" rows={3} maxLength={1000} defaultValue={c.description ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="e-purchase_instructions">{f.purchase_instructions}</label>
              <textarea className="input py-2" id="e-purchase_instructions" name="purchase_instructions" rows={3} maxLength={1000} defaultValue={c.purchase_instructions ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="e-requirements">{f.requirements}</label>
              <textarea className="input py-2" id="e-requirements" name="requirements" rows={2} maxLength={1000} defaultValue={c.requirements ?? ""} />
            </div>
            <button className="btn">{d.editSave}</button>
          </form>
        </details>
      )}

      {editable && (
        <details className="mt-4">
          <summary className="cursor-pointer py-2 text-sm font-semibold text-red-700">{hasClaims ? d.closeTitle : d.deleteTitle}</summary>
          <form action={closeCampaign} className="mt-2 rounded-xl bg-red-50 p-4">
            <input type="hidden" name="campaign_id" value={c.id} />
            <p className="text-sm text-red-900">{hasClaims ? d.closeHint : d.deleteHint}</p>
            <button className="btn mt-3 bg-red-700 hover:bg-red-800">{hasClaims ? d.closeButton : d.deleteButton}</button>
          </form>
        </details>
      )}
    </div>
  );
}
