import { AdminNotice } from "@/components/admin-notice";
import { createClient } from "@/lib/supabase/server";
import { day } from "@/lib/format";
import { t } from "@/lib/i18n/hr";
import { setTrustScore, setUserStatus } from "../actions";

export const metadata = { title: t.admin.tabs.users };

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/korisnici">) {
  const sp = await searchParams;
  const u = t.admin.users;
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, status, trust_score, completed_reviews_count, missed_deadlines_count, suspended_until, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="max-w-3xl">
      <AdminNotice sp={sp} />
      <p className="mb-4 text-sm text-ink/65">{u.banHint}</p>
      <ul className="space-y-4">
        {(users ?? []).map((p) => (
          <li key={p.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-bold">{p.full_name ?? p.email}</p>
                <p className="text-sm text-ink/65">{p.email} · {day(p.created_at)}</p>
              </div>
              <p className="text-sm font-semibold">
                {u.role[p.role]} · {u.status[p.status]}
                {p.status === "suspended" && p.suspended_until ? ` ${t.admin.until(day(p.suspended_until))}` : ""}
              </p>
            </div>
            {p.role === "tester" && (
              <p className="mt-1 text-sm text-ink/65">
                {t.admin.trust(p.trust_score)} · {u.stats(p.completed_reviews_count, p.missed_deadlines_count)}
              </p>
            )}
            {p.role !== "admin" && (
              <details className="mt-3 border-t border-stone-200 pt-3">
                <summary className="cursor-pointer py-2 text-sm font-semibold text-brand">{u.setStatus}</summary>
                <form action={setUserStatus} className="mt-2 grid gap-3 sm:grid-cols-3">
                  <input type="hidden" name="user_id" value={p.id} />
                  <div>
                    <label className="label" htmlFor={`st-${p.id}`}>{u.setStatus}</label>
                    <select className="input" id={`st-${p.id}`} name="status" defaultValue={p.status}>
                      {Object.entries(u.status).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor={`d-${p.id}`}>{u.days}</label>
                    <input className="input" id={`d-${p.id}`} name="days" type="number" min={1} max={365} defaultValue={30} />
                  </div>
                  <div>
                    <label className="label" htmlFor={`n-${p.id}`}>{t.admin.note}</label>
                    <input className="input" id={`n-${p.id}`} name="note" maxLength={300} />
                  </div>
                  <div className="sm:col-span-3"><button className="btn">{u.apply}</button></div>
                </form>
                {p.role === "tester" && (
                  <form action={setTrustScore} className="mt-4 grid gap-3 border-t border-stone-200 pt-4 sm:grid-cols-3">
                    <input type="hidden" name="user_id" value={p.id} />
                    <div>
                      <label className="label" htmlFor={`ts-${p.id}`}>{u.trustLabel}</label>
                      <input className="input" id={`ts-${p.id}`} name="score" type="number" min={0} max={100} defaultValue={p.trust_score} required />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label" htmlFor={`tn-${p.id}`}>{t.admin.note}</label>
                      <input className="input" id={`tn-${p.id}`} name="note" maxLength={300} />
                    </div>
                    <div className="sm:col-span-3"><button className="btn-ghost">{u.setTrust}</button></div>
                  </form>
                )}
              </details>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
