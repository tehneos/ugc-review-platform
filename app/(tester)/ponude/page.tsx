import { OFFER_COLUMNS, OfferCard, type Offer } from "@/components/offer-card";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/hr";

export const metadata = { title: t.offers.title };

export default async function OffersPage() {
  const supabase = await createClient();
  // Stupci se navode izričito: select * ne prolazi zbog column-level granta.
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select(OFFER_COLUMNS)
    .eq("status", "active")
    .eq("country_code", "HR")
    .order("created_at", { ascending: false });

  return (
    <>
      <h1 className="section-title">{t.offers.title}</h1>
      <p className="mt-2 text-ink/65">{t.offers.intro}</p>
      {!campaigns?.length ? (
        <p className="card mt-8 text-ink/65">{t.offers.empty}</p>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(campaigns as Offer[]).map((c) => (
            <li key={c.id}>
              <OfferCard offer={c} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
