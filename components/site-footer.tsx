import Link from "next/link";
import { t } from "@/lib/i18n/hr";

export function SiteFooter() {
  const f = t.footer;
  return (
    <footer className="mt-auto border-t border-stone-200 bg-tint-2/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="text-lg font-extrabold text-accent">{t.appName}</p>
          <p className="mt-2 max-w-xs text-sm text-ink/65">{f.tagline}</p>
        </div>
        <nav aria-label={f.testers}>
          <p className="text-sm font-bold">{f.testers}</p>
          <ul className="mt-2 space-y-1 text-sm text-ink/70">
            <li><Link href="/ponude" className="inline-block py-1 hover:text-accent">{t.nav.offers}</Link></li>
            <li><Link href="/registracija?uloga=tester" className="inline-block py-1 hover:text-accent">{f.becomeTester}</Link></li>
            <li><Link href="/prijava" className="inline-block py-1 hover:text-accent">{t.nav.login}</Link></li>
          </ul>
        </nav>
        <nav aria-label={f.brands}>
          <p className="text-sm font-bold">{f.brands}</p>
          <ul className="mt-2 space-y-1 text-sm text-ink/70">
            <li><Link href="/registracija?uloga=brand" className="inline-block py-1 hover:text-accent">{f.startCampaign}</Link></li>
            <li><Link href="/#za-brendove" className="inline-block py-1 hover:text-accent">{f.howForBrands}</Link></li>
          </ul>
        </nav>
      </div>
      <p className="border-t border-stone-200 px-4 py-4 text-center text-xs text-ink/55">{f.disclosure}</p>
    </footer>
  );
}
