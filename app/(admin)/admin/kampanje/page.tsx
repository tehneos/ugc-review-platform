import { AdminNotice } from "@/components/admin-notice";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/format";
import { t } from "@/lib/i18n/hr";
import { setCampaignStatus, updateCampaign } from "../actions";

export const metadata = { title: t.admin.tabs.campaigns };

export default async function AdminCampaignsPage({ searchParams }: PageProps<"/admin/kampanje">) {
  const sp = await searchParams;
  const a = t.admin.campaigns;
  const f = t.campaigns.form;
  const supabase = await createClient();
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, title, description, product_name, product_url, product_image_url, product_price, currency, discount_percent, status, slots_total, slots_taken, brands(name)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="max-w-3xl">
      <AdminNotice sp={sp} />
      {!campaigns?.length && <p className="card text-sm text-ink/65">{t.admin.none}</p>}
      <ul className="space-y-4">
        {(campaigns ?? []).map((c) => {
          const brand = Array.isArray(c.brands) ? c.brands[0] : c.brands;
          return (
            <li key={c.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{c.title}</p>
                  <p className="text-sm text-ink/65">
                    {brand?.name} · {c.product_name} · {money(Number(c.product_price), c.currency)} · −{c.discount_percent} %
                  </p>
                </div>
                <p className="text-sm font-semibold">{t.campaigns.status[c.status]} · {t.campaigns.slots(c.slots_taken, c.slots_total)}</p>
              </div>

              {c.status !== "cancelled" && (
                <form action={setCampaignStatus} className="mt-3 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="campaign_id" value={c.id} />
                  {c.status === "active" && <button name="intent" value="pause" className="btn-ghost">{a.pause}</button>}
                  {(c.status === "paused" || c.status === "draft") && <button name="intent" value="resume" className="btn-ghost">{a.resume}</button>}
                </form>
              )}

              <details className="mt-3 border-t border-stone-200 pt-3">
                <summary className="cursor-pointer py-2 text-sm font-semibold text-brand">{a.edit}</summary>
                <form action={updateCampaign} className="mt-2 space-y-3">
                  <input type="hidden" name="campaign_id" value={c.id} />
                  <div>
                    <label className="label" htmlFor={`t-${c.id}`}>{f.title}</label>
                    <input className="input" id={`t-${c.id}`} name="title" defaultValue={c.title} required maxLength={120} />
                  </div>
                  <div>
                    <label className="label" htmlFor={`p-${c.id}`}>{f.product_name}</label>
                    <input className="input" id={`p-${c.id}`} name="product_name" defaultValue={c.product_name} required maxLength={120} />
                  </div>
                  <div>
                    <label className="label" htmlFor={`u-${c.id}`}>{f.product_url}</label>
                    <input className="input" id={`u-${c.id}`} name="product_url" type="url" defaultValue={c.product_url} required />
                  </div>
                  <div>
                    <label className="label" htmlFor={`i-${c.id}`}>{f.product_image_url}</label>
                    <input className="input" id={`i-${c.id}`} name="product_image_url" type="url" defaultValue={c.product_image_url ?? ""} />
                  </div>
                  <div>
                    <label className="label" htmlFor={`d-${c.id}`}>{f.description}</label>
                    <textarea className="input py-2" id={`d-${c.id}`} name="description" rows={3} maxLength={1000} defaultValue={c.description ?? ""} />
                  </div>
                  <button className="btn">{a.save}</button>
                </form>
              </details>

              {c.status !== "cancelled" && (
                <details className="mt-1">
                  <summary className="cursor-pointer py-2 text-sm font-semibold text-red-700">{a.cancel}</summary>
                  <form action={setCampaignStatus} className="mt-2 rounded-lg bg-red-50 p-3">
                    <input type="hidden" name="campaign_id" value={c.id} />
                    <p className="text-sm text-red-900">{a.cancelHint}</p>
                    <button name="intent" value="cancel" className="btn mt-3 bg-red-700 hover:bg-red-800">{a.cancel}</button>
                  </form>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
