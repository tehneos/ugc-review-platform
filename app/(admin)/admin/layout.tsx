import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { requireAdmin } from "@/lib/auth";
import { t } from "@/lib/i18n/hr";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  const tabs = [
    { href: "/admin", label: t.admin.tabs.overview },
    { href: "/admin/korisnici", label: t.admin.tabs.users },
    { href: "/admin/kampanje", label: t.admin.tabs.campaigns },
    { href: "/admin/recenzije", label: t.admin.tabs.reviews },
  ];
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold">{t.admin.title}</h1>
        <nav className="mt-4 mb-6 flex flex-wrap gap-2 border-b border-stone-200 pb-4">
          {tabs.map((x) => (
            <Link key={x.href} href={x.href} className="btn-ghost">
              {x.label}
            </Link>
          ))}
        </nav>
        {children}
      </main>
    </>
  );
}
