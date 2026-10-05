import { SiteHeader } from "@/components/site-header";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { day, hoursAgo, hoursSince } from "@/lib/format";
import { t } from "@/lib/i18n/hr";
import { liftSuspension, resolveOrder } from "./actions";

export const metadata = { title: t.admin.title };

const ESCALATE_AFTER_HOURS = 72;

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  await requireAdmin();
  const sp = await searchParams;
  const a = t.admin;
  const supabase = await createClient();
  const cutoff = hoursAgo(ESCALATE_AFTER_HOURS);

  const count = (table: string, col: string, values: string[]) =>
    supabase.from(table).select("id", { count: "exact", head: true }).in(col, values).then((r) => r.count ?? 0);

  const orderCols = "id, status, external_order_number, proof_file_path, claimed_at, updated_at, campaigns(product_name, fulfillment_mode, brands(name))";
  const [testers, brands, activeCampaigns, openOrders, pendingReviews, published, proofs, shipments, suspended] = await Promise.all([
    count("profiles", "role", ["tester"]),
    supabase.from("brands").select("id", { count: "exact", head: true }).then((r) => r.count ?? 0),
    count("campaigns", "status", ["active"]),
    count("orders", "status", ["claimed", "purchase_submitted", "purchase_verified", "review_submitted"]),
    count("reviews", "status", ["pending"]),
    count("reviews", "status", ["approved"]),
    supabase.from("orders").select(orderCols).eq("status", "purchase_submitted").lt("updated_at", cutoff).order("updated_at"),
    supabase.from("orders").select(orderCols).eq("status", "claimed").is("shipped_at", null).lt("claimed_at", cutoff).order("claimed_at"),
    supabase.from("profiles").select("id, email, full_name, trust_score, suspended_until").eq("status", "suspended").order("suspended_until"),
  ]);

  const flat = (rows: NonNullable<typeof proofs.data>) =>
    rows.map((o) => {
      const c = Array.isArray(o.campaigns) ? o.campaigns[0] : o.campaigns;
      const b = c && (Array.isArray(c.brands) ? c.brands[0] : c.brands);
      return { ...o, product: c?.product_name, mode: c?.fulfillment_mode, brand: b?.name };
    });
  const stuckProofs = flat(proofs.data ?? []);
  const stuckShipments = flat(shipments.data ?? []).filter((o) => o.mode === "brand_ships");

  const proofUrls = new Map<string, string>();
  await Promise.all(
    stuckProofs
      .filter((o) => o.proof_file_path)
      .map(async (o) => {
        const { data } = await supabase.storage.from("purchase-proofs").createSignedUrl(o.proof_file_path!, 600);
        if (data) proofUrls.set(o.id, data.signedUrl);
      }),
  );
  const stats = [
    [a.stats.testers, testers], [a.stats.brands, brands], [a.stats.activeCampaigns, activeCampaigns],
    [a.stats.openOrders, openOrders], [a.stats.pendingReviews, pendingReviews], [a.stats.published, published],
  ] as const;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold">{a.title}</h1>
        {sp.greska && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{t.auth.errors.generic}</p>}

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map(([label, value]) => (
            <div key={label} className="card p-4">
              <dt className="text-xs text-stone-500">{label}</dt>
              <dd className="mt-1 text-2xl font-bold">{value}</dd>
            </div>
          ))}
        </dl>

        <section className="mt-8 max-w-2xl">
          <h2 className="font-semibold">{a.stuckProofs}</h2>
          {!stuckProofs.length ? <p className="card mt-3 text-sm text-stone-600">{a.none}</p> : (
            <ul className="mt-3 space-y-3">
              {stuckProofs.map((o) => (
                <li key={o.id} className="card">
                  <p className="font-semibold">{o.product} <span className="font-normal text-stone-500">· {o.brand} · {a.waiting(hoursSince(o.updated_at))}</span></p>
                  <p className="mt-1 text-sm text-stone-700">{t.brandOrders.orderNumber}: <span className="font-mono">{o.external_order_number ?? t.brandOrders.noNumber}</span></p>
                  {proofUrls.has(o.id) && (
                    <a href={proofUrls.get(o.id)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm font-medium text-brand">{a.proof} ↗</a>
                  )}
                  <form action={resolveOrder} className="mt-3 flex flex-wrap gap-3">
                    <input type="hidden" name="order_id" value={o.id} />
                    <button name="intent" value="verify" className="btn">{a.verify}</button>
                    <button name="intent" value="cancel" className="btn-ghost">{a.cancel}</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8 max-w-2xl">
          <h2 className="font-semibold">{a.stuckShipments}</h2>
          {!stuckShipments.length ? <p className="card mt-3 text-sm text-stone-600">{a.none}</p> : (
            <ul className="mt-3 space-y-3">
              {stuckShipments.map((o) => (
                <li key={o.id} className="card">
                  <p className="font-semibold">{o.product} <span className="font-normal text-stone-500">· {o.brand} · {a.waiting(hoursSince(o.claimed_at))}</span></p>
                  <form action={resolveOrder} className="mt-3">
                    <input type="hidden" name="order_id" value={o.id} />
                    <button name="intent" value="cancel" className="btn-ghost">{a.cancel}</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8 max-w-2xl">
          <h2 className="font-semibold">{a.suspended}</h2>
          {!suspended.data?.length ? <p className="card mt-3 text-sm text-stone-600">{a.none}</p> : (
            <ul className="mt-3 space-y-3">
              {suspended.data.map((p) => (
                <li key={p.id} className="card flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm">
                    <span className="font-semibold">{p.full_name ?? p.email}</span>
                    <span className="block text-stone-600">
                      {p.email} · {a.trust(p.trust_score)}{p.suspended_until ? ` · ${a.until(day(p.suspended_until))}` : ""}
                    </span>
                  </span>
                  <form action={liftSuspension}>
                    <input type="hidden" name="tester_id" value={p.id} />
                    <button className="btn-ghost">{a.lift}</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
