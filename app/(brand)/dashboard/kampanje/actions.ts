"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireBrandMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { errorCode } from "@/lib/format";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function createCampaign(formData: FormData) {
  const { brand } = await requireBrandMember();
  if (!brand) redirect("/dashboard/onboarding");

  const supabase = await createClient();
  // Sva provjera polja je u funkciji create_campaign u bazi.
  const { data, error } = await supabase.rpc("create_campaign", {
    p_brand_id: brand.id,
    p_title: str(formData, "title"),
    p_product_name: str(formData, "product_name"),
    p_product_url: str(formData, "product_url"),
    p_product_price: Number(str(formData, "product_price").replace(",", ".")),
    p_discount_percent: Number(str(formData, "discount_percent")),
    p_slots_total: Number(str(formData, "slots_total")),
    p_fulfillment_mode: formData.get("fulfillment_mode") === "brand_ships" ? "brand_ships" : "coupon_purchase",
    p_coupon_mode: formData.get("coupon_mode") === "shared" ? "shared" : "unique",
    p_shared_coupon_code: str(formData, "shared_coupon_code"),
    p_description: str(formData, "description"),
    p_product_image_url: str(formData, "product_image_url"),
    p_purchase_instructions: str(formData, "purchase_instructions"),
    p_requirements: str(formData, "requirements"),
    p_min_photos: Number(str(formData, "min_photos") || "1"),
  });

  if (error) redirect(`/dashboard/kampanje/nova?greska=${errorCode(error.message)}`);

  const reviewUrl = str(formData, "external_review_url");
  if (reviewUrl) {
    const { error: urlError } = await supabase.rpc("set_campaign_review_url", { p_campaign_id: data, p_url: reviewUrl });
    if (urlError) redirect(`/dashboard/kampanje/${data}?greska=${errorCode(urlError.message)}`);
  }
  redirect(`/dashboard/kampanje/${data}`);
}

export async function setReviewUrl(formData: FormData) {
  await requireBrandMember();
  const id = str(formData, "campaign_id");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_campaign_review_url", {
    p_campaign_id: id,
    p_url: str(formData, "external_review_url"),
  });
  redirect(`/dashboard/kampanje/${id}?${error ? `greska=${errorCode(error.message)}` : "poveznica=1"}`);
}

export async function importCoupons(formData: FormData) {
  await requireBrandMember();
  const id = str(formData, "campaign_id");
  const codes = String(formData.get("codes") ?? "")
    .split(/[\r\n,;]+/)
    .map((c) => c.trim())
    .filter(Boolean);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_campaign_coupons", { p_campaign_id: id, p_codes: codes });
  if (error) redirect(`/dashboard/kampanje/${id}?greska=${errorCode(error.message)}`);
  redirect(`/dashboard/kampanje/${id}?uvezeno=${data}`);
}

export async function setCampaignStatus(formData: FormData) {
  await requireBrandMember();
  const id = str(formData, "campaign_id");
  const fn = formData.get("intent") === "pause" ? "pause_campaign" : "publish_campaign";

  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, { p_campaign_id: id });
  if (error) redirect(`/dashboard/kampanje/${id}?greska=${errorCode(error.message)}`);
  revalidatePath("/ponude");
  redirect(`/dashboard/kampanje/${id}${fn === "publish_campaign" ? "?objavljeno=1" : ""}`);
}

export async function updateCampaign(formData: FormData) {
  await requireBrandMember();
  const id = str(formData, "campaign_id");
  // Polje koje forma nije poslala (zaključano) ide kao null: baza ga ostavlja kakvo jest.
  const text = (key: string) => (formData.has(key) ? str(formData, key) : null);
  const num = (key: string) => (formData.has(key) && str(formData, key) !== "" ? Number(str(formData, key).replace(",", ".")) : null);
  const pick = <T extends string>(key: string, allowed: readonly T[]) =>
    allowed.includes(formData.get(key) as T) ? (formData.get(key) as T) : null;

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_campaign", {
    p_campaign_id: id,
    p_title: text("title"),
    p_description: text("description"),
    p_product_url: text("product_url"),
    p_product_image_url: text("product_image_url"),
    p_purchase_instructions: text("purchase_instructions"),
    p_requirements: text("requirements"),
    p_slots_total: num("slots_total"),
    p_product_name: text("product_name"),
    p_product_price: num("product_price"),
    p_discount_percent: num("discount_percent"),
    p_min_photos: num("min_photos"),
    p_fulfillment_mode: pick("fulfillment_mode", ["coupon_purchase", "brand_ships"] as const),
    p_coupon_mode: pick("coupon_mode", ["unique", "shared"] as const),
    p_shared_coupon_code: text("shared_coupon_code"),
  });
  if (!error) revalidatePath("/ponude");
  redirect(`/dashboard/kampanje/${id}?${error ? `greska=${errorCode(error.message)}` : "uredeno=1"}`);
}

export async function setTargeting(formData: FormData) {
  await requireBrandMember();
  const id = str(formData, "campaign_id");
  const age = (key: string) => (str(formData, key) === "" ? null : Number(str(formData, key)));
  const gender = str(formData, "target_gender");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_campaign_targeting", {
    p_campaign_id: id,
    p_gender: gender === "female" || gender === "male" ? gender : null,
    p_age_min: age("target_age_min"),
    p_age_max: age("target_age_max"),
    p_interests: formData.getAll("target_interests").map(String),
  });
  if (!error) revalidatePath("/ponude");
  redirect(`/dashboard/kampanje/${id}?${error ? `greska=${errorCode(error.message)}` : "ciljanje=1"}`);
}

export async function closeCampaign(formData: FormData) {
  await requireBrandMember();
  const id = str(formData, "campaign_id");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("close_campaign", { p_campaign_id: id });
  if (error) redirect(`/dashboard/kampanje/${id}?greska=${errorCode(error.message)}`);
  revalidatePath("/ponude");
  redirect(data === "deleted" ? "/dashboard/kampanje?obrisano=1" : `/dashboard/kampanje/${id}?zatvoreno=1`);
}
