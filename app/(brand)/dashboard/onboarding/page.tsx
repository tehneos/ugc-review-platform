import { redirect } from "next/navigation";
import { requireBrandMember } from "@/lib/auth";
import { t } from "@/lib/i18n/hr";
import { createBrand } from "./actions";

export const metadata = { title: t.onboarding.title };

export default async function OnboardingPage({ searchParams }: PageProps<"/dashboard/onboarding">) {
  const { brand } = await requireBrandMember({ allowNoBrand: true });
  if (brand) redirect("/dashboard");
  const sp = await searchParams;
  const errorKey = typeof sp.greska === "string" ? sp.greska : null;

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold">{t.onboarding.title}</h1>
      {errorKey && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {t.onboarding.errors[errorKey] ?? t.auth.errors.generic}
        </p>
      )}
      <form action={createBrand} className="card mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="name">{t.onboarding.name}</label>
          <input className="input" id="name" name="name" required minLength={2} maxLength={80} />
        </div>
        <div>
          <label className="label" htmlFor="slug">{t.onboarding.slug}</label>
          <input className="input" id="slug" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={2} maxLength={60} aria-describedby="slug-hint" />
          <p id="slug-hint" className="mt-1 text-xs text-stone-500">{t.onboarding.slugHint}</p>
        </div>
        <div>
          <label className="label" htmlFor="website_url">{t.onboarding.website}</label>
          <input className="input" id="website_url" name="website_url" type="url" placeholder="https://" />
        </div>
        <div>
          <label className="label" htmlFor="description">{t.onboarding.description}</label>
          <textarea className="input py-2" id="description" name="description" rows={3} maxLength={500} />
        </div>
        <button className="btn">{t.onboarding.submit}</button>
      </form>
    </div>
  );
}
