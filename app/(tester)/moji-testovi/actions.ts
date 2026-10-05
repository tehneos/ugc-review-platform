"use server";

import { redirect } from "next/navigation";
import { requireTester } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { errorCode } from "@/lib/format";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

// Sva pravila (vlasništvo narudžbe, stanje, rokovi, datoteke) provjeravaju funkcije u bazi.

export async function submitProof(formData: FormData) {
  await requireTester();
  const id = str(formData, "order_id");
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_purchase_proof", {
    p_order_id: id,
    p_order_number: str(formData, "order_number"),
    p_proof_path: str(formData, "proof_path") || null,
  });
  redirect(`/moji-testovi/${id}${error ? `?greska=${errorCode(error.message)}` : ""}`);
}

export async function confirmReceived(formData: FormData) {
  await requireTester();
  const id = str(formData, "order_id");
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_received", { p_order_id: id });
  redirect(`/moji-testovi/${id}${error ? `?greska=${errorCode(error.message)}` : ""}`);
}

export async function submitReview(formData: FormData) {
  await requireTester();
  const id = str(formData, "order_id");
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_review", {
    p_order_id: id,
    p_rating: Number(str(formData, "rating")) || null,
    p_title: str(formData, "title"),
    p_body: str(formData, "body"),
    p_photo_paths: formData.getAll("photo_path").map(String),
    p_media_consent: formData.get("media_consent") === "on",
  });
  redirect(`/moji-testovi/${id}${error ? `?greska=${errorCode(error.message)}` : ""}`);
}

export async function markExternalPosted(formData: FormData) {
  await requireTester();
  const id = str(formData, "order_id");
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_external_posted", { p_review_id: str(formData, "review_id") });
  redirect(`/moji-testovi/${id}${error ? `?greska=${errorCode(error.message)}` : ""}`);
}
