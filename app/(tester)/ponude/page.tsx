import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/hr";

export const metadata = { title: t.offers.title };

export default async function OffersPage() {
  const supabase = await createClient();
  // Stupci se navode izričito: select * ne prolazi zbog column-level granta.
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select(
      "id, slug, title, product_name, product_image_url, product_price, currency, discount_percent, slots_total, slots_taken, brands(name)",
    )
    .eq("status", "active")
    .eq("country_code", "HR")
    .order("created_at", { ascending: false });

  return (
    <>
      <h1 className="text-2xl font-bold">{t.offers.title}</h1>
      {!campaigns?.length ? (
        <p className="card mt-6 text-stone-600">{t.offers.empty}</p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => {
            const brand = Array.isArray(c.brands) ? c.brands[0] : c.brands;
            const price = Number(c.product_price) * (1 - c.discount_percent / 100);
            return (
              <li key={c.id}>
                <Link href={`/ponude/${c.slug}`} className="card block h-full hover:border-brand">
                <p className="text-xs font-medium text-stone-500">{brand?.name}</p>
                <h2 className="mt-1 font-semibold">{c.product_name}</h2>
                <p className="mt-2 text-lg font-bold text-brand">
                  {c.discount_percent === 100
                    ? t.offers.free
                    : new Intl.NumberFormat("hr-HR", { style: "currency", currency: c.currency }).format(price)}
                  <span className="ml-2 text-sm font-medium text-stone-500">−{c.discount_percent} %</span>
                </p>
                <p className="mt-2 text-sm text-stone-600">{t.offers.slotsLeft(c.slots_total - c.slots_taken)}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
