import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { t } from "@/lib/i18n/hr";

export async function SiteHeader() {
  const profile = await getProfile();
  const links = !profile
    ? [{ href: "/ponude", label: t.nav.offers }]
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
        ];

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-brand">
          {t.appName}
        </Link>
        <nav className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-1 text-sm font-medium text-stone-700">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="py-2 hover:text-brand">
              {l.label}
            </Link>
          ))}
        </nav>
        {profile ? (
          <form action="/auth/odjava" method="post">
            <button className="py-2 text-sm font-medium text-stone-600 hover:text-brand">{t.nav.logout}</button>
          </form>
        ) : (
          <div className="flex items-center gap-3 text-sm font-medium">
            <Link href="/prijava" className="py-2 text-stone-700 hover:text-brand">
              {t.nav.login}
            </Link>
            <Link href="/registracija" className="btn">
              {t.nav.register}
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
