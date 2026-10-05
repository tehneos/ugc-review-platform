import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBrandMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/hr";

export const metadata = { title: t.campaigns.title };

export default async function CampaignsPage() {
  const { brand } = await requireBrandMember();
  if (!brand) redirect("/dashboard/onboarding");

  const supabase = await createClient();
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, title, product_name, status, slots_total, slots_taken, discount_percent")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t.campaigns.title}</h1>
        <Link href="/dashboard/kampanje/nova" className="btn">{t.campaigns.new}</Link>
      </div>
      {!campaigns?.length ? (
        <p className="card mt-6 text-stone-600">{t.campaigns.empty}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {campaigns.map((c) => (
            <li key={c.id}>
              <Link href={`/dashboard/kampanje/${c.id}`} className="card flex flex-wrap items-center justify-between gap-2 hover:border-brand">
                <span>
                  <span className="font-semibold">{c.title}</span>
                  <span className="block text-sm text-stone-600">{c.product_name} · −{c.discount_percent} %</span>
                </span>
                <span className="text-sm text-stone-600">
                  {t.campaigns.status[c.status]} · {t.campaigns.slots(c.slots_taken, c.slots_total)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
