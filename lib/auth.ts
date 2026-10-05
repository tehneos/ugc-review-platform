import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  role: "tester" | "brand" | "admin";
  email: string;
  full_name: string | null;
  display_name: string | null;
  phone: string | null;
  country_code: string;
  status: "active" | "suspended" | "banned";
  trust_score: number;
  completed_reviews_count: number;
  missed_deadlines_count: number;
  suspended_until: string | null;
  terms_accepted_at: string | null;
  media_consent_at: string | null;
  whatsapp_opt_in: boolean;
};

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (data as Profile) ?? null;
}

/** Početna stranica korisnika prema ulozi. */
export function homeFor(role: Profile["role"]) {
  return role === "tester" ? "/ponude" : role === "admin" ? "/admin" : "/dashboard";
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireUser();
  if (profile.role !== "admin") redirect(homeFor(profile.role));
  return profile;
}

export async function requireUser(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/prijava");
  return profile;
}

export async function requireTester(): Promise<Profile> {
  const profile = await requireUser();
  if (profile.role !== "tester") redirect(homeFor(profile.role));
  return profile;
}

/** Vraća profil i brend; korisnika bez brenda šalje na onboarding. */
export async function requireBrandMember(opts: { allowNoBrand?: boolean } = {}) {
  const profile = await requireUser();
  if (profile.role !== "brand") redirect(homeFor(profile.role));

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("brand_members")
    .select("role, brand_id")
    .eq("user_id", profile.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    if (!opts.allowNoBrand) redirect("/dashboard/onboarding");
    return { profile, brand: null };
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, slug, logo_url, website_url, description, country_code")
    .eq("id", membership.brand_id)
    .single();

  return { profile, brand };
}
