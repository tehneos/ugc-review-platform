import Link from "next/link";
import { login } from "../actions";
import { t } from "@/lib/i18n/hr";

export const metadata = { title: t.auth.loginTitle };

export default async function LoginPage({ searchParams }: PageProps<"/prijava">) {
  const sp = await searchParams;
  const errorKey = typeof sp.greska === "string" ? sp.greska : null;
  const next = typeof sp.next === "string" ? sp.next : "";
  const errors = t.auth.errors as Record<string, string>;

  return (
    <div className="card">
      <h1 className="text-2xl font-bold">{t.auth.loginTitle}</h1>
      {errorKey && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {errors[errorKey] ?? errors.generic}
        </p>
      )}
      <form action={login} className="mt-5 space-y-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <label className="label" htmlFor="email">{t.auth.email}</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">{t.auth.password}</label>
          <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <button className="btn w-full">{t.auth.submitLogin}</button>
      </form>
      <p className="mt-5 text-sm text-stone-600">
        {t.auth.noAccount}{" "}
        <Link href="/registracija" className="font-semibold text-brand">{t.nav.register}</Link>
      </p>
    </div>
  );
}
