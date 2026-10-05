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
  redirect(`/dashboard/kampanje/${data}`);
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
  const fn = formData.get("action") === "pause" ? "pause_campaign" : "publish_campaign";

  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, { p_campaign_id: id });
  if (error) redirect(`/dashboard/kampanje/${id}?greska=${errorCode(error.message)}`);
  revalidatePath("/ponude");
  redirect(`/dashboard/kampanje/${id}${fn === "publish_campaign" ? "?objavljeno=1" : ""}`);
}
