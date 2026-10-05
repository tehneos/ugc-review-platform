"use server";

import { redirect } from "next/navigation";
import { requireBrandMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function createBrand(formData: FormData) {
  await requireBrandMember({ allowNoBrand: true });
  const supabase = await createClient();

  // Sva provjera (naziv, adresa, zauzetost) je u funkciji create_brand u bazi.
  const { error } = await supabase.rpc("create_brand", {
    p_name: String(formData.get("name") ?? ""),
    p_slug: String(formData.get("slug") ?? "").trim().toLowerCase(),
    p_website_url: String(formData.get("website_url") ?? ""),
    p_description: String(formData.get("description") ?? ""),
  });

  if (error) {
    const code = /^[A-Z_]+$/.test(error.message) ? error.message : "GENERIC";
    redirect(`/dashboard/onboarding?greska=${code}`);
  }
  redirect("/dashboard");
}
