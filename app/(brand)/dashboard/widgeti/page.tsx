import { redirect } from "next/navigation";
import { WidgetPreview } from "@/components/widget-preview";
import { requireBrandMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/hr";
import { createWidget, toggleWidget } from "./actions";

export const metadata = { title: t.widgets.title };

export default async function WidgetsPage({ searchParams }: PageProps<"/dashboard/widgeti">) {
  const { brand } = await requireBrandMember();
  if (!brand) redirect("/dashboard/onboarding");
  const sp = await searchParams;
  const w = t.widgets;

  const supabase = await createClient();
  const [{ data: widgets }, { data: campaigns }] = await Promise.all([
    supabase
      .from("widgets")
      .select("id, name, type, public_key, allowed_domains, is_active, campaign_id")
      .eq("brand_id", brand.id)
      .order("created_at", { ascending: false }),
    supabase.from("campaigns").select("id, title").eq("brand_id", brand.id).order("created_at", { ascending: false }),
  ]);
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">{w.title}</h1>
      <p className="mt-1 text-sm text-stone-600">{w.intro}</p>
      {sp.greska && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{t.auth.errors.generic}</p>}

      {!widgets?.length ? (
        <p className="card mt-6 text-stone-600">{w.empty}</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {widgets.map((x) => (
            <li key={x.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">{x.name}</h2>
                <form action={toggleWidget} className="flex items-center gap-3 text-sm">
                  <span className="text-stone-600">{x.is_active ? w.active : w.inactive}</span>
                  <input type="hidden" name="widget_id" value={x.id} />
                  <button name="active" value={x.is_active ? "0" : "1"} className="btn-ghost">
                    {x.is_active ? w.turnOff : w.turnOn}
                  </button>
                </form>
              </div>
              <p className="mt-1 text-xs text-stone-500">
                {x.type === "grid" ? w.typeGrid : w.typeCarousel} ·{" "}
                {campaigns?.find((c) => c.id === x.campaign_id)?.title ?? w.allCampaigns} ·{" "}
                {x.allowed_domains.length ? x.allowed_domains.join(", ") : w.anyDomain}
              </p>
              <h3 className="mt-4 text-sm font-semibold">{w.embed}</h3>
              <pre className="mt-1 overflow-x-auto rounded-lg bg-stone-900 p-3 text-xs text-stone-100 select-all">
                <code>{`<script src="${site}/widget.js" data-widget="${x.public_key}" async></script>`}</code>
              </pre>
              {x.is_active && (
                <>
                  <h3 className="mt-4 text-sm font-semibold">{w.preview}</h3>
                  <div className="mt-2 rounded-lg border border-dashed border-stone-300 p-3">
                    <WidgetPreview publicKey={x.public_key} />
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <form action={createWidget} className="card mt-8 space-y-4">
        <h2 className="font-semibold">{w.newTitle}</h2>
        <div>
          <label className="label" htmlFor="name">{w.name}</label>
          <input className="input" id="name" name="name" required maxLength={80} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="type">{w.type}</label>
            <select className="input" id="type" name="type" defaultValue="carousel">
              <option value="carousel">{w.typeCarousel}</option>
              <option value="grid">{w.typeGrid}</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="campaign_id">{w.campaign}</label>
            <select className="input" id="campaign_id" name="campaign_id" defaultValue="">
              <option value="">{w.allCampaigns}</option>
              {campaigns?.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="domains">{w.domains}</label>
          <textarea className="input py-2" id="domains" name="domains" rows={2} aria-describedby="domains-hint" />
          <p id="domains-hint" className="mt-1 text-xs text-stone-500">{w.domainsHint}</p>
        </div>
        <button className="btn">{w.create}</button>
      </form>
    </div>
  );
}
