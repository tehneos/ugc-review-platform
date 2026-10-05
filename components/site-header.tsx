import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { t } from "@/lib/i18n/hr";

export async function SiteHeader() {
  const profile = await getProfile();
  const links = !profile
    ? [
        { href: "/ponude", label: t.nav.offers },
        { href: "/#kako-radi", label: t.nav.how },
        { href: "/#za-brendove", label: t.nav.forBrands },
      ]
    : profile.role === "admin"
      ? [{ href: "/admin", label: t.nav.admin }]
      : profile.role === "tester"
        ? [
            { href: "/ponude", label: t.nav.offers },
            { href: "/moji-testovi", label: t.nav.myTests },
            { href: "/profil", label: t.nav.profile },
          ]
        : [
            { href: "/dashboard", label: t.nav.dashboard },
            { href: "/dashboard/kampanje", label: t.nav.campaigns },
            { href: "/dashboard/narudzbe", label: t.nav.orders },
            { href: "/dashboard/recenzije", label: t.nav.reviews },
            { href: "/dashboard/widgeti", label: t.nav.widgets },
          ];

  return (
    <header className="sticky top-0 z-20 border-b border-stone-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-1 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-brand">
          {/* eslint-disable-next-line @next/next/no-img-element -- mali SVG znak, bez optimizacije */}
          <img src="/icon.svg" alt="" width={30} height={30} />
          {t.appName}
        </Link>
        <nav className="order-3 flex w-full flex-wrap items-center gap-x-6 text-sm font-semibold text-ink/75 sm:order-none sm:w-auto sm:flex-1">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="py-2 hover:text-brand">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 text-sm font-semibold">
          {profile ? (
            <form action="/auth/odjava" method="post">
              <button className="min-h-11 px-2 text-ink/70 hover:text-brand">{t.nav.logout}</button>
            </form>
          ) : (
            <>
              <Link href="/prijava" className="inline-flex min-h-11 items-center px-3 text-ink/80 hover:text-brand">
                {t.nav.login}
              </Link>
              <Link href="/registracija" className="btn">
                {t.nav.register}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
