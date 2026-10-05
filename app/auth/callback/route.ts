import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { homeFor } from "@/lib/auth";

/** Odredište poveznice iz e-maila za potvrdu adrese. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const origin = request.nextUrl.origin;
  if (!code) return NextResponse.redirect(`${origin}/prijava?greska=generic`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(`${origin}/prijava?greska=generic`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, terms_accepted_at")
    .eq("id", data.user.id)
    .single();

  // Uvjeti su prihvaćeni na formi registracije; bilježimo ih pri prvoj prijavi.
  if (profile && !profile.terms_accepted_at) {
    await supabase.from("profiles").update({ terms_accepted_at: new Date().toISOString() }).eq("id", data.user.id);
  }

  return NextResponse.redirect(`${origin}${homeFor(profile?.role ?? "tester")}`);
}
