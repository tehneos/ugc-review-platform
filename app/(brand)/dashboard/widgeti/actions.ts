"use server";

import { redirect } from "next/navigation";
import { requireBrandMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** "https://www.MojShop.hr/kosarica" → "mojshop.hr" */
function normalizeDomain(raw: string) {
  const host = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#:]/)[0];
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : null;
}

export async function createWidget(formData: FormData) {
  const { brand } = await requireBrandMember();
  if (!brand) redirect("/dashboard/onboarding");

  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const campaignId = String(formData.get("campaign_id") ?? "");
  const domains = String(formData.get("domains") ?? "")
    .split(/[\r\n,;\s]+/)
    .map(normalizeDomain)
    .filter((d): d is string => !!d);

  const supabase = await createClient();
  // RLS dopušta upis samo članu brenda; brand_id dolazi sa servera, ne iz forme.
  const { error } = await supabase.from("widgets").insert({
    brand_id: brand.id,
    name: name || "Widget",
    type: formData.get("type") === "grid" ? "grid" : "carousel",
    campaign_id: campaignId || null,
    allowed_domains: [...new Set(domains)].slice(0, 10),
  });
  redirect(`/dashboard/widgeti${error ? "?greska=1" : ""}`);
}

export async function toggleWidget(formData: FormData) {
  const { brand } = await requireBrandMember();
  if (!brand) redirect("/dashboard/onboarding");
  const supabase = await createClient();
  await supabase
    .from("widgets")
    .update({ is_active: formData.get("active") === "1" })
    .eq("id", String(formData.get("widget_id") ?? ""))
    .eq("brand_id", brand.id);
  redirect("/dashboard/widgeti");
}
