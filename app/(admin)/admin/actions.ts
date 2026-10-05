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

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const back = (path: string, error: { message: string } | null) =>
  redirect(`${path}?${error ? `greska=${errorCode(error.message)}` : "ok=1"}`);

export async function setUserStatus(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const status = str(formData, "status");
  const { error } = await supabase.rpc("admin_set_user_status", {
    p_user_id: str(formData, "user_id"),
    p_status: ["active", "suspended", "banned"].includes(status) ? status : "active",
    p_days: Number(str(formData, "days")) || 30,
    p_note: str(formData, "note"),
  });
  back("/admin/korisnici", error);
}

export async function setTrustScore(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const raw = str(formData, "score");
  const { error } = await supabase.rpc("admin_set_trust_score", {
    p_user_id: str(formData, "user_id"),
    p_score: raw === "" ? null : Number(raw),
    p_note: str(formData, "note"),
  });
  back("/admin/korisnici", error);
}

export async function setCampaignStatus(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const intent = str(formData, "intent");
  const { error } = await supabase.rpc("admin_set_campaign_status", {
    p_campaign_id: str(formData, "campaign_id"),
    p_status: intent === "cancel" ? "cancelled" : intent === "pause" ? "paused" : "active",
  });
  back("/admin/kampanje", error);
}

export async function updateCampaign(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_campaign", {
    p_campaign_id: str(formData, "campaign_id"),
    p_title: str(formData, "title"),
    p_product_name: str(formData, "product_name"),
    p_product_url: str(formData, "product_url"),
    p_product_image_url: str(formData, "product_image_url"),
    p_description: str(formData, "description"),
  });
  back("/admin/kampanje", error);
}

export async function setReviewVisibility(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_review_visibility", {
    p_review_id: str(formData, "review_id"),
    p_hidden: formData.get("intent") === "hide",
    p_note: str(formData, "note"),
  });
  back("/admin/recenzije", error);
}
