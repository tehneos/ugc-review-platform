import { t } from "@/lib/i18n/hr";

/** Ključevi interesa; isti popis je u ograničenjima baze (migracija 0011). */
export const INTERESTS = [
  "hrana_pice", "ljepota_njega", "moda", "dom_vrt", "tehnika", "sport",
  "auto_moto", "djeca_bebe", "kucni_ljubimci", "zdravlje", "hobi_alat", "gaming",
] as const;

export type Targeting = {
  target_gender: string | null;
  target_age_min: number | null;
  target_age_max: number | null;
  target_interests: string[];
};

export type TesterTraits = { birth_year: number | null; gender: string | null; interests: string[] };

export const TARGET_COLUMNS = "target_gender, target_age_min, target_age_max, target_interests";

export function hasTargeting(c: Targeting) {
  return !!(c.target_gender || c.target_age_min || c.target_age_max || c.target_interests.length);
}

/** Ista pravila kao campaign_matches_profile u bazi; baza je mjerodavna, ovo služi prikazu. */
export function matchesTargeting(c: Targeting, p: TesterTraits, year: number) {
  const age = p.birth_year ? year - p.birth_year : null;
  if (c.target_gender && p.gender !== c.target_gender) return false;
  if (c.target_age_min && (age === null || age < c.target_age_min)) return false;
  if (c.target_age_max && (age === null || age > c.target_age_max)) return false;
  if (c.target_interests.length && !c.target_interests.some((i) => p.interests.includes(i))) return false;
  return true;
}

/** "Muškarci · 25–45 godina · Auto i moto, Tehnika" */
export function describeTargeting(c: Targeting) {
  const g = t.targeting;
  const parts: string[] = [];
  if (c.target_gender) parts.push(g.genderPlural[c.target_gender]);
  if (c.target_age_min && c.target_age_max) parts.push(g.ageBetween(c.target_age_min, c.target_age_max));
  else if (c.target_age_min) parts.push(g.ageFrom(c.target_age_min));
  else if (c.target_age_max) parts.push(g.ageTo(c.target_age_max));
  if (c.target_interests.length) parts.push(c.target_interests.map((i) => g.interests[i] ?? i).join(", "));
  return parts.join(" · ");
}
