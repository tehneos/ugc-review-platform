"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { homeFor } from "@/lib/auth";

const loginSchema = z.object({ email: z.email(), password: z.string().min(1) });

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  full_name: z.string().trim().min(2).max(100),
  role: z.enum(["tester", "brand"]),
  terms: z.literal("on"),
});

/** Dopušta samo interne putanje, da ?next= ne može preusmjeriti na tuđu stranicu. */
function safeNext(next: FormDataEntryValue | null) {
  const v = typeof next === "string" ? next : "";
  return v.startsWith("/") && !v.startsWith("//") ? v : null;
}

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/prijava?greska=invalid");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    redirect(`/prijava?greska=${error.code === "email_not_confirmed" ? "notConfirmed" : "credentials"}`);
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
  redirect(safeNext(formData.get("next")) ?? homeFor(profile?.role ?? "tester"));
}

export async function register(formData: FormData) {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/registracija?greska=invalid");
  const { email, password, full_name, role } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name, role, country_code: "HR" },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });
  if (error) {
    redirect(`/registracija?greska=${error.code === "user_already_exists" ? "exists" : "generic"}`);
  }

  if (data.session) {
    await supabase.from("profiles").update({ terms_accepted_at: new Date().toISOString() }).eq("id", data.user!.id);
    redirect(homeFor(role));
  }
  redirect("/registracija?poslano=1");
}
