export function money(amount: number, currency: string) {
  return new Intl.NumberFormat("hr-HR", { style: "currency", currency }).format(amount);
}

export function day(iso: string) {
  return new Date(iso).toLocaleDateString("hr-HR", { timeZone: "Europe/Zagreb" });
}

/** Poruka greške iz funkcije u bazi je kod (npr. INVALID_PRICE); sve ostalo je GENERIC. */
export function errorCode(message: string | undefined) {
  return message && /^[A-Z_]+$/.test(message) ? message : "GENERIC";
}

export function reviewPhotoUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/review-media/${path}`;
}

export function hoursSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3600_000);
}

export function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 3600_000).toISOString();
}
