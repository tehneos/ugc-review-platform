import Link from "next/link";
import { OFFER_COLUMNS, OfferCard, type Offer } from "@/components/offer-card";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/hr";
import { matchesTargeting } from "@/lib/targeting";

export const metadata = { title: t.offers.title };

export default async function OffersPage() {
  const supabase = await createClient();
  // Stupci se navode izričito: select * ne prolazi zbog column-level granta.
  const [{ data }, profile] = await Promise.all([
    supabase.from("campaigns").select(OFFER_COLUMNS).eq("status", "active").eq("country_code", "HR").order("created_at", { ascending: false }),
    getProfile(),
  ]);
  const all = (data ?? []) as unknown as Offer[];

  // Tester vidi samo ponude koje odgovaraju njegovu profilu; posjetitelji i brendovi vide sve.
  const year = new Date().getFullYear();
  const campaigns = profile?.role === "tester" ? all.filter((c) => matchesTargeting(c, profile, year)) : all;
  const hidden = all.length - campaigns.length;

  return (
    <>
      <h1 className="section-title">{t.offers.title}</h1>
      <p className="mt-2 text-ink/65">{t.offers.intro}</p>
      {hidden > 0 && (
        <p className="mt-4 rounded-xl bg-tint p-3 text-sm text-ink/80">
          {t.targeting.hiddenCount(hidden)}{" "}
          <Link href="/profil" className="font-bold underline">{t.targeting.completeProfile}</Link>
        </p>
      )}
      {!campaigns.length ? (
        <p className="card mt-8 text-ink/65">{t.offers.empty}</p>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <li key={c.id}>
              <OfferCard offer={c} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
