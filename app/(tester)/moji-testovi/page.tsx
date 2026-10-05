import Link from "next/link";
import { requireTester } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/hr";

export const metadata = { title: t.myTests.title };

export default async function MyTestsPage() {
  const profile = await requireTester();
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, status, purchase_due_at, review_due_at, campaigns(product_name)")
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
            return (
              <li key={o.id} className="card flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{c?.product_name}</span>
                <span className="text-sm text-stone-600">{o.status}</span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
