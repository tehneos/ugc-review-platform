"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTester } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  display_name: z.string().trim().max(40),
  phone: z.string().trim().max(30),
});

export async function updateProfile(formData: FormData) {
  const profile = await requireTester();
  const parsed = schema.safeParse({
    display_name: formData.get("display_name") ?? "",
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) redirect("/profil?greska=1");

  const wantsConsent = formData.get("media_consent") === "on";
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.display_name || null,
      phone: parsed.data.phone || null,
      whatsapp_opt_in: formData.get("whatsapp_opt_in") === "on",
      // Datum privole čuva se od prvog pristanka; povlačenje ga briše.
      media_consent_at: wantsConsent ? (profile.media_consent_at ?? new Date().toISOString()) : null,
    })
    .eq("id", profile.id);

  redirect(error ? "/profil?greska=1" : "/profil?spremljeno=1");
}
