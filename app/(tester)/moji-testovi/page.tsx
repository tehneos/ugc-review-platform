import Link from "next/link";
import { requireTester } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { day } from "@/lib/format";
import { t } from "@/lib/i18n/hr";

export const metadata = { title: t.myTests.title };

export default async function MyTestsPage() {
  const profile = await requireTester();
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, status, coupon_code, purchase_due_at, review_due_at, campaigns(product_name, product_url, fulfillment_mode, brands(name))")
    .eq("tester_id", profile.id)
    .order("claimed_at", { ascending: false });

  return (
    <>
      <h1 className="text-2xl font-bold">{t.myTests.title}</h1>
      {!orders?.length ? (
        <div className="card mt-6">
          <p className="text-stone-600">{t.myTests.empty}</p>
          <Link href="/ponude" className="btn mt-4">{t.myTests.browse}</Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {orders.map((o) => {
            const c = Array.isArray(o.campaigns) ? o.campaigns[0] : o.campaigns;
            const brand = c && (Array.isArray(c.brands) ? c.brands[0] : c.brands);
            const ships = c?.fulfillment_mode === "brand_ships";
            return (
              <li key={o.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-stone-500">{brand?.name}</p>
                    <h2 className="font-semibold">{c?.product_name}</h2>
                  </div>
                  <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
                    {t.orderStatus[o.status] ?? o.status}
                  </span>
                </div>
                {o.status === "claimed" && !ships && (
                  <div className="mt-3 text-sm text-stone-700">
                    {o.coupon_code && (
                      <p>
                        {t.order.coupon}: <code className="rounded bg-teal-50 px-2 py-1 font-mono font-semibold text-teal-900">{o.coupon_code}</code>
                      </p>
                    )}
                    <p className="mt-2">{t.order.buyBy(day(o.purchase_due_at))}</p>
                    {c?.product_url && (
                      <a href={c.product_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 inline-block font-medium text-brand">
                        {t.offer.productLink} ↗
                      </a>
                    )}
                  </div>
                )}
                {o.status === "claimed" && ships && <p className="mt-3 text-sm text-stone-700">{t.order.waitingShipment}</p>}
                {o.status === "purchase_verified" && o.review_due_at && (
                  <p className="mt-3 text-sm font-medium text-stone-800">{t.order.reviewBy(day(o.review_due_at))}
                <Link href={`/moji-testovi/${o.id}`} className="btn-ghost mt-4">{t.test.open}</Link></p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
