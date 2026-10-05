import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { t } from "@/lib/i18n/hr";

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-14">
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">{t.landing.title}</h1>
        <p className="mt-4 max-w-xl text-lg text-stone-600">{t.landing.subtitle}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/registracija?uloga=tester" className="btn">
            {t.landing.ctaTester}
          </Link>
          <Link href="/registracija?uloga=brand" className="btn-ghost">
            {t.landing.ctaBrand}
          </Link>
        </div>
        <ol className="mt-14 grid gap-4 sm:grid-cols-3">
          {t.landing.steps.map((s, i) => (
            <li key={s.title} className="card">
              <span className="text-sm font-semibold text-brand">{i + 1}.</span>
              <h2 className="mt-1 font-semibold">{s.title}</h2>
              <p className="mt-1 text-sm text-stone-600">{s.text}</p>
            </li>
          ))}
        </ol>
      </main>
    </>
  );
}
