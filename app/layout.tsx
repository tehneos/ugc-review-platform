import type { Metadata } from "next";
import "./globals.css";
import { t } from "@/lib/i18n/hr";

export const metadata: Metadata = {
  title: { default: t.appName, template: `%s · ${t.appName}` },
  description: t.landing.subtitle,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="hr" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
