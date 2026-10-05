import Link from "next/link";
import { money } from "@/lib/format";
import { t } from "@/lib/i18n/hr";

export type Offer = {
  id: string;
  slug: string;
  product_name: string;
  product_image_url: string | null;
  product_price: number | string;
  currency: string;
  discount_percent: number;
  slots_total: number;
  slots_taken: number;
  brands: { name: string } | { name: string }[] | null;
};

export const OFFER_COLUMNS =
  "id, slug, product_name, product_image_url, product_price, currency, discount_percent, slots_total, slots_taken, brands(name)";

/** Kartica ponude: fotografija proizvoda je glavni element, popust je značka preko nje. */
export function OfferCard({ offer: c }: { offer: Offer }) {
  const brand = Array.isArray(c.brands) ? c.brands[0] : c.brands;
  const price = Number(c.product_price);
  const left = c.slots_total - c.slots_taken;
  const free = c.discount_percent === 100;

  return (
    <Link
      href={`/ponude/${c.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_2px_rgb(29_26_57/0.04),0_8px_24px_-12px_rgb(29_26_57/0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgb(29_26_57/0.06),0_16px_32px_-12px_rgb(29_26_57/0.2)]"
    >
      <div className="relative aspect-[4/3] bg-gradient-to-br from-tint to-tint-2">
        {c.product_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- slika je s domene brenda, nepoznate unaprijed
          <img src={c.product_image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden className="flex h-full items-center justify-center text-6xl font-extrabold text-brand/25">
            {c.product_name.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="absolute top-3 left-3 rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">
          {free ? t.offers.free : `−${c.discount_percent} %`}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-semibold text-ink/55">{brand?.name}</p>
        <h3 className="mt-0.5 font-bold group-hover:text-brand">{c.product_name}</h3>
        <p className="mt-2 flex items-baseline gap-2">
          <span className="text-lg font-extrabold">{free ? t.offers.free : money(price * (1 - c.discount_percent / 100), c.currency)}</span>
          <span className="text-sm text-ink/45 line-through">{money(price, c.currency)}</span>
        </p>
        <p className={`mt-auto pt-3 text-xs font-semibold ${left > 0 ? "text-ink/60" : "text-ink/40"}`}>
          {left > 0 ? t.offers.slotsLeft(left) : t.offer.full}
        </p>
      </div>
    </Link>
  );
}
