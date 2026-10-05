import { requireTester } from "@/lib/auth";
import { t } from "@/lib/i18n/hr";
import { INTERESTS } from "@/lib/targeting";
import { updateProfile } from "./actions";

export const metadata = { title: t.profile.title };

export default async function ProfilePage({ searchParams }: PageProps<"/profil">) {
  const profile = await requireTester();
  const sp = await searchParams;
  const stats = [
    { label: t.profile.trustScore, value: `${profile.trust_score}/100` },
    { label: t.profile.completed, value: profile.completed_reviews_count },
    { label: t.profile.missed, value: profile.missed_deadlines_count },
  ];

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold">{t.profile.title}</h1>
      <p className="mt-1 text-sm text-stone-600">{profile.full_name} · {profile.email}</p>

      {profile.status === "suspended" && profile.suspended_until && (
        <p role="alert" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {t.profile.suspended(new Date(profile.suspended_until).toLocaleDateString("hr-HR"))}
        </p>
      )}

      <dl className="mt-6 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <dt className="text-xs text-stone-500">{s.label}</dt>
            <dd className="mt-1 text-xl font-bold">{s.value}</dd>
          </div>
        ))}
      </dl>

      {sp.spremljeno && <p role="status" className="mt-6 rounded-lg bg-teal-50 p-3 text-sm text-teal-900">{t.profile.saved}</p>}
      {sp.greska && <p role="alert" className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-800">{t.auth.errors.generic}</p>}

      <form action={updateProfile} className="card mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="display_name">{t.profile.displayName}</label>
          <input className="input" id="display_name" name="display_name" maxLength={40} defaultValue={profile.display_name ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="phone">{t.profile.phone}</label>
          <input className="input" id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={profile.phone ?? ""} />
        </div>
        <fieldset className="space-y-4 border-t border-stone-200 pt-4">
          <legend className="font-semibold">{t.targeting.profileTitle}</legend>
          <p className="text-sm text-ink/65">{t.targeting.profileIntro}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="birth_year">{t.targeting.birthYear}</label>
              <input className="input" id="birth_year" name="birth_year" type="number" inputMode="numeric" min={1900} max={2100} placeholder="npr. 1990" defaultValue={profile.birth_year ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="gender">{t.targeting.gender}</label>
              <select className="input" id="gender" name="gender" defaultValue={profile.gender ?? ""}>
                {Object.entries(t.targeting.genderOptions).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <span className="label">{t.targeting.interestsLabel}</span>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((i) => (
                <label key={i} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-stone-300 bg-white px-4 text-sm has-checked:border-ink has-checked:bg-brand">
                  <input type="checkbox" name="interests" value={i} defaultChecked={profile.interests?.includes(i)} className="sr-only" />
                  {t.targeting.interests[i]}
                </label>
              ))}
            </div>
          </div>
        </fieldset>
        <label className="flex items-start gap-2 text-sm text-stone-700">
          <input type="checkbox" name="media_consent" defaultChecked={!!profile.media_consent_at} className="mt-1" />
          {t.profile.mediaConsent}
        </label>
        <label className="flex items-start gap-2 text-sm text-stone-700">
          <input type="checkbox" name="whatsapp_opt_in" defaultChecked={profile.whatsapp_opt_in} className="mt-1" />
          {t.profile.whatsapp}
        </label>
        <button className="btn">{t.profile.save}</button>
      </form>
    </div>
  );
}
