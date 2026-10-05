import { redirect } from "next/navigation";
import { requireBrandMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { day } from "@/lib/format";
import { t } from "@/lib/i18n/hr";
import { handlePurchase, markShipped } from "./actions";

export const metadata = { title: t.brandOrders.title };

type Address = { full_name?: string; street?: string; postal_code?: string; city?: string; phone?: string | null };

export default async function BrandOrdersPage({ searchParams }: PageProps<"/dashboard/narudzbe">) {
  const { brand } = await requireBrandMember();
  if (!brand) redirect("/dashboard/onboarding");
  const sp = await searchParams;
  const b = t.brandOrders;

  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id, status, external_order_number, proof_file_path, shipping_address, shipped_at, tracking_number, claimed_at, campaigns(product_name, fulfillment_mode)")
    .eq("brand_id", brand.id)
    .in("status", ["purchase_submitted", "claimed"])
    .order("claimed_at", { ascending: true });

  const orders = (data ?? []).map((o) => ({ ...o, campaign: Array.isArray(o.campaigns) ? o.campaigns[0] : o.campaigns }));
  const toVerify = orders.filter((o) => o.status === "purchase_submitted");
  const shipping = orders.filter((o) => o.status === "claimed" && o.campaign?.fulfillment_mode === "brand_ships");
  const toShip = shipping.filter((o) => !o.shipped_at);
  const inTransit = shipping.filter((o) => o.shipped_at);

  // Privatni bucket: poveznica na dokaz vrijedi 10 minuta.
  const proofUrls = new Map<string, string>();
  await Promise.all(
    toVerify
      .filter((o) => o.proof_file_path)
      .map(async (o) => {
        const { data: signed } = await supabase.storage.from("purchase-proofs").createSignedUrl(o.proof_file_path!, 600);
        if (signed) proofUrls.set(o.id, signed.signedUrl);
      }),
  );
  const errorKey = typeof sp.greska === "string" ? sp.greska : null;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">{b.title}</h1>
      {errorKey && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {b.errors[errorKey] ?? t.auth.errors.generic}
        </p>
      )}
      {toVerify.length + toShip.length + inTransit.length === 0 && <p className="card mt-6 text-stone-600">{b.empty}</p>}

      {toVerify.length > 0 && (
        <section className="mt-6">
          <h2 className="font-semibold">{b.toVerify}</h2>
          <ul className="mt-3 space-y-3">
            {toVerify.map((o) => (
              <li key={o.id} className="card">
                <p className="font-semibold">{o.campaign?.product_name}</p>
                <p className="mt-1 text-sm text-stone-700">
                  {b.orderNumber}: <span className="font-mono">{o.external_order_number ?? b.noNumber}</span>
                </p>
                {proofUrls.has(o.id) && (
                  <a href={proofUrls.get(o.id)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm font-medium text-accent">
                    {b.proof} ↗
                  </a>
                )}
                <form action={handlePurchase} className="mt-3 space-y-3">
                  <input type="hidden" name="order_id" value={o.id} />
                  <button name="intent" value="verify" className="btn">{b.verify}</button>
                  <div className="border-t border-stone-200 pt-3">
                    <label className="label" htmlFor={`note-${o.id}`}>{b.rejectNote}</label>
                    <input className="input" id={`note-${o.id}`} name="note" maxLength={500} />
                    <button name="intent" value="reject" className="btn-ghost mt-2">{b.reject}</button>
                  </div>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {toShip.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold">{b.toShip}</h2>
          <ul className="mt-3 space-y-3">
            {toShip.map((o) => {
              const a = (o.shipping_address ?? {}) as Address;
              return (
                <li key={o.id} className="card">
                  <p className="font-semibold">{o.campaign?.product_name}</p>
                  <address className="mt-2 text-sm text-stone-700 not-italic">
                    {a.full_name}<br />{a.street}<br />{a.postal_code} {a.city}
                    {a.phone ? <><br />{a.phone}</> : null}
                  </address>
                  <form action={markShipped} className="mt-3 space-y-2">
                    <input type="hidden" name="order_id" value={o.id} />
                    <label className="label" htmlFor={`trk-${o.id}`}>{b.tracking}</label>
                    <input className="input" id={`trk-${o.id}`} name="tracking_number" maxLength={80} />
                    <button className="btn mt-1">{b.markShipped}</button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {inTransit.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold">{b.inTransit}</h2>
          <ul className="mt-3 space-y-2">
            {inTransit.map((o) => (
              <li key={o.id} className="card flex flex-wrap justify-between gap-2 text-sm">
                <span className="font-semibold">{o.campaign?.product_name}</span>
                <span className="text-stone-600">{b.shippedOn(day(o.shipped_at!))}{o.tracking_number ? ` · ${o.tracking_number}` : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
