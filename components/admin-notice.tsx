import { t } from "@/lib/i18n/hr";

/** Poruka nakon admin radnje: ?greska=KOD ili ?ok=1. */
export function AdminNotice({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const errorKey = typeof sp.greska === "string" ? sp.greska : null;
  if (errorKey) {
    return (
      <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
        {t.admin.errors[errorKey] ?? t.auth.errors.generic}
      </p>
    );
  }
  if (sp.ok) return <p role="status" className="mb-4 rounded-lg bg-teal-50 p-3 text-sm text-teal-900">{t.admin.saved}</p>;
  return null;
}
