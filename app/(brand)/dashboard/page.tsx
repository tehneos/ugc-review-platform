import { redirect } from "next/navigation";
import { requireBrandMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/hr";

export const metadata = { title: t.dashboard.title };

export default async function DashboardPage() {
  const { brand } = await requireBrandMember();
  if (!brand) redirect("/dashboard/onboarding");

  const supabase = await createClient();
  const count = (table: string, status?: string) => {
    let q = supabase.from(table).select("id", { count: "exact", head: true }).eq("brand_id", brand.id);
    if (status) q = q.eq("status", status);
    return q.then((r) => r.count ?? 0);
  };
  const [campaigns, pending, published] = await Promise.all([
    count("campaigns"),
    count("reviews", "pending"),
    count("reviews", "approved"),
  ]);
  const stats = [
    { label: t.dashboard.stats.campaigns, value: campaigns },
    { label: t.dashboard.stats.pending, value: pending },
    { label: t.dashboard.stats.published, value: published },
  ];

  return (
    <>
      <h1 className="text-2xl font-bold">{t.dashboard.welcome(brand.name)}</h1>
      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <dt className="text-sm text-stone-500">{s.label}</dt>
            <dd className="mt-1 text-2xl font-bold">{s.value}</dd>
          </div>
        ))}
      </dl>
      {campaigns === 0 && <p className="card mt-6 text-stone-600">{t.dashboard.noCampaigns}</p>}
    </>
  );
}
