"use server";

import { redirect } from "next/navigation";
import { requireBrandMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { errorCode } from "@/lib/format";

export async function moderateReview(formData: FormData) {
  await requireBrandMember();
  const supabase = await createClient();
  const approve = formData.get("intent") === "approve";
  const { error } = await supabase.rpc("moderate_review", {
    p_review_id: String(formData.get("review_id") ?? ""),
    p_approve: approve,
    p_reason: approve ? null : String(formData.get("reason") ?? "") || null,
    p_note: approve ? null : String(formData.get("note") ?? ""),
  });
  redirect(`/dashboard/recenzije${error ? `?greska=${errorCode(error.message)}` : ""}`);
}
