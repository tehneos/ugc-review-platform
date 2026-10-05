"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { errorCode } from "@/lib/format";

// Funkcije u bazi same provjeravaju ulogu admina; requireAdmin je samo prva prepreka.

export async function resolveOrder(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_resolve_order", {
    p_order_id: String(formData.get("order_id") ?? ""),
    p_action: formData.get("intent") === "verify" ? "verify" : "cancel",
  });
  redirect(`/admin${error ? `?greska=${errorCode(error.message)}` : ""}`);
}

export async function liftSuspension(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_lift_suspension", { p_tester_id: String(formData.get("tester_id") ?? "") });
  redirect(`/admin${error ? `?greska=${errorCode(error.message)}` : ""}`);
}
