import { redirect } from "next/navigation";
import { requireBrandMember } from "@/lib/auth";
import { t } from "@/lib/i18n/hr";
import { createCampaign } from "../actions";

export const metadata = { title: t.campaigns.new };

export default async function NewCampaignPage({ searchParams }: PageProps<"/dashboard/kampanje/nova">) {
  const { brand } = await requireBrandMember();
  if (!brand) redirect("/dashboard/onboarding");
  const sp = await searchParams;
  const errorKey = typeof sp.greska === "string" ? sp.greska : null;
  const f = t.campaigns.form;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">{t.campaigns.new}</h1>
      {errorKey && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {t.campaigns.errors[errorKey] ?? t.auth.errors.generic}
        </p>
      )}
      <form action={createCampaign} className="card mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="title">{f.title}</label>
          <input className="input" id="title" name="title" required minLength={3} maxLength={120} />
        </div>
        <div>
          <label className="label" htmlFor="product_name">{f.product_name}</label>
          <input className="input" id="product_name" name="product_name" required minLength={2} maxLength={120} />
        </div>
        <div>
          <label className="label" htmlFor="product_url">{f.product_url}</label>
          <input className="input" id="product_url" name="product_url" type="url" required placeholder="https://" />
        </div>
        <div>
          <label className="label" htmlFor="product_image_url">{f.product_image_url}</label>
          <input className="input" id="product_image_url" name="product_image_url" type="url" placeholder="https://" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="product_price">{f.product_price}</label>
            <input className="input" id="product_price" name="product_price" inputMode="decimal" required />
          </div>
          <div>
            <label className="label" htmlFor="discount_percent">{f.discount_percent}</label>
            <input className="input" id="discount_percent" name="discount_percent" type="number" min={50} max={100} defaultValue={100} required aria-describedby="discount-hint" />
            <p id="discount-hint" className="mt-1 text-xs text-stone-500">{f.discountHint}</p>
          </div>
          <div>
            <label className="label" htmlFor="slots_total">{f.slots_total}</label>
            <input className="input" id="slots_total" name="slots_total" type="number" min={1} max={500} defaultValue={10} required />
          </div>
          <div>
            <label className="label" htmlFor="min_photos">{f.min_photos}</label>
            <select className="input" id="min_photos" name="min_photos" defaultValue="1">
              <option>1</option><option>2</option><option>3</option>
            </select>
          </div>
        </div>

        <fieldset>
          <legend className="label">{f.fulfillment}</legend>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2"><input type="radio" name="fulfillment_mode" value="coupon_purchase" defaultChecked /> {f.modeCoupon}</label>
            <label className="flex items-center gap-2"><input type="radio" name="fulfillment_mode" value="brand_ships" /> {f.modeShips}</label>
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-stone-200 p-4">
          <legend className="label px-1">{f.couponMode}</legend>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2"><input type="radio" name="coupon_mode" value="shared" defaultChecked /> {f.couponShared}</label>
            <label className="flex items-center gap-2"><input type="radio" name="coupon_mode" value="unique" /> {f.couponUnique}</label>
          </div>
          <label className="label mt-3" htmlFor="shared_coupon_code">{f.shared_coupon_code}</label>
          <input className="input" id="shared_coupon_code" name="shared_coupon_code" maxLength={64} />
          <p className="mt-2 text-xs text-stone-500">{f.couponHint}</p>
        </fieldset>

        <div>
          <label className="label" htmlFor="description">{f.description}</label>
          <textarea className="input py-2" id="description" name="description" rows={3} maxLength={1000} />
        </div>
        <div>
          <label className="label" htmlFor="purchase_instructions">{f.purchase_instructions}</label>
          <textarea className="input py-2" id="purchase_instructions" name="purchase_instructions" rows={3} maxLength={1000} />
        </div>
        <div>
          <label className="label" htmlFor="requirements">{f.requirements}</label>
          <textarea className="input py-2" id="requirements" name="requirements" rows={2} maxLength={1000} />
        </div>
        <div>
          <label className="label" htmlFor="external_review_url">{f.external_review_url}</label>
          <input className="input" id="external_review_url" name="external_review_url" type="url" placeholder="https://" aria-describedby="ext-hint" />
          <p id="ext-hint" className="mt-1 text-xs text-stone-500">{f.externalHint}</p>
        </div>
        <button className="btn">{f.submit}</button>
      </form>
    </div>
  );
}
