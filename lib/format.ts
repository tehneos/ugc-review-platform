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
