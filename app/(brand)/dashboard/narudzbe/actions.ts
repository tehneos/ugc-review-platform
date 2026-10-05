"use server";

import { redirect } from "next/navigation";
import { requireBrandMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { errorCode } from "@/lib/format";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function handlePurchase(formData: FormData) {
  await requireBrandMember();
  const supabase = await createClient();
  const id = str(formData, "order_id");
  const { error } =
    formData.get("intent") === "reject"
      ? await supabase.rpc("reject_purchase", { p_order_id: id, p_note: str(formData, "note") })
      : await supabase.rpc("verify_purchase", { p_order_id: id });
  redirect(`/dashboard/narudzbe${error ? `?greska=${errorCode(error.message)}` : ""}`);
}

export async function markShipped(formData: FormData) {
  await requireBrandMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_shipped", {
    p_order_id: str(formData, "order_id"),
    p_tracking_number: str(formData, "tracking_number"),
  });
  redirect(`/dashboard/narudzbe${error ? `?greska=${errorCode(error.message)}` : ""}`);
}
