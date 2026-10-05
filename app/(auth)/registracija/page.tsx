import Link from "next/link";
import { register } from "../actions";
import { t } from "@/lib/i18n/hr";

export const metadata = { title: t.auth.registerTitle };

export default async function RegisterPage({ searchParams }: PageProps<"/registracija">) {
  const sp = await searchParams;
  const errorKey = typeof sp.greska === "string" ? sp.greska : null;
  const role = sp.uloga === "brand" ? "brand" : "tester";
  const errors = t.auth.errors as Record<string, string>;

  if (sp.poslano) {
    return (
      <div className="card">
        <h1 className="text-2xl font-bold">{t.auth.registerTitle}</h1>
        <p className="mt-4 text-stone-700">{t.auth.checkEmail}</p>
        <Link href="/prijava" className="btn mt-6">{t.nav.login}</Link>
      </div>
    );
  }

  return (
    <div className="card">
      <h1 className="text-2xl font-bold">{t.auth.registerTitle}</h1>
      {errorKey && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {errors[errorKey] ?? errors.generic}
        </p>
      )}
      <form action={register} className="mt-5 space-y-4">
        <fieldset>
          <legend className="label">{t.auth.roleLabel}</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["tester", "brand"] as const).map((r) => (
              <label key={r} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 text-sm has-checked:border-brand has-checked:bg-teal-50">
                <input type="radio" name="role" value={r} defaultChecked={role === r} />
                {r === "tester" ? t.auth.roleTester : t.auth.roleBrand}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label className="label" htmlFor="full_name">{t.auth.fullName}</label>
          <input className="input" id="full_name" name="full_name" autoComplete="name" required minLength={2} />
        </div>
        <div>
          <label className="label" htmlFor="email">{t.auth.email}</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">{t.auth.password}</label>
          <input className="input" id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </div>
        <label className="flex items-start gap-2 text-sm text-stone-700">
          <input type="checkbox" name="terms" required className="mt-1" />
          {t.auth.terms}
        </label>
        <button className="btn w-full">{t.auth.submitRegister}</button>
      </form>
      <p className="mt-5 text-sm text-stone-600">
        {t.auth.hasAccount}{" "}
        <Link href="/prijava" className="font-semibold text-brand">{t.nav.login}</Link>
      </p>
    </div>
  );
}
