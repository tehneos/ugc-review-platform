"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorCode } from "@/lib/format";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function claimSlot(formData: FormData) {
  const slug = str(formData, "slug");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/prijava?next=${encodeURIComponent(`/ponude/${slug}`)}`);

  const hasAddress = formData.has("street");
  // Sva pravila (slobodna mjesta, suspenzija, adresa, kupon) provjerava funkcija u bazi.
  const { error } = await supabase.rpc("claim_campaign_slot", {
    p_campaign_id: str(formData, "campaign_id"),
    p_shipping_address: hasAddress
      ? {
          full_name: str(formData, "full_name"),
          street: str(formData, "street"),
          postal_code: str(formData, "postal_code"),
          city: str(formData, "city"),
          phone: str(formData, "phone"),
        }
      : null,
  });

  if (error) redirect(`/ponude/${slug}?greska=${errorCode(error.message)}`);
  revalidatePath("/ponude");
  redirect("/moji-testovi");
}
