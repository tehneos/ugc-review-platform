import type { Metadata } from "next";
import "./globals.css";
import { t } from "@/lib/i18n/hr";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: `${t.appName} — ${t.landing.title}`, template: `%s · ${t.appName}` },
  description: t.landing.subtitle,
  applicationName: t.appName,
  // Slika za pregled poveznice je app/opengraph-image.jpg; ikone su app/icon.svg i app/apple-icon.png.
  openGraph: { type: "website", locale: "hr_HR", siteName: t.appName, title: `${t.appName} — ${t.landing.title}`, description: t.landing.subtitle },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="hr" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
