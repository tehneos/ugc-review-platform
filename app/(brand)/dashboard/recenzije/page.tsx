import { redirect } from "next/navigation";
import { requireBrandMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { day, reviewPhotoUrl } from "@/lib/format";
import { t } from "@/lib/i18n/hr";
import { confirmExternal, moderateReview } from "./actions";

export const metadata = { title: t.moderation.title };

type Media = { storage_path: string; position: number; removed_at: string | null };

function Photos({ media, alt }: { media: Media[]; alt: string }) {
  const shown = media.filter((m) => !m.removed_at).sort((a, b) => a.position - b.position);
  if (!shown.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {shown.map((m) => (
        <li key={m.storage_path}>
          <a href={reviewPhotoUrl(m.storage_path)} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element -- slike iz Supabase Storagea */}
            <img src={reviewPhotoUrl(m.storage_path)} alt={alt} loading="lazy" className="h-28 w-28 rounded-lg border border-stone-200 object-cover" />
          </a>
        </li>
      ))}
    </ul>
  );
}

export default async function ModerationPage({ searchParams }: PageProps<"/dashboard/recenzije">) {
  const { brand } = await requireBrandMember();
  if (!brand) redirect("/dashboard/onboarding");
  const sp = await searchParams;
  const m = t.moderation;

  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("id, status, rating, title, body, display_name, resubmitted, created_at, published_at, external_posted_at, external_confirmed_at, campaigns(product_name, external_review_url), review_media(storage_path, position, removed_at)")
    .eq("brand_id", brand.id)
    .in("status", ["pending", "approved"])
    .order("created_at", { ascending: false });

  const reviews = (data ?? []).map((r) => ({ ...r, campaign: Array.isArray(r.campaigns) ? r.campaigns[0] : r.campaigns }));
  const pending = reviews.filter((r) => r.status === "pending");
  const published = reviews.filter((r) => r.status === "approved");
  const errorKey = typeof sp.greska === "string" ? sp.greska : null;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">{m.title}</h1>
      <p className="mt-1 text-sm text-stone-600">{m.autoApprove}</p>
      {errorKey && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {m.errors[errorKey] ?? t.auth.errors.generic}
        </p>
      )}

      <section className="mt-6">
        <h2 className="font-semibold">{m.pending}</h2>
        {!pending.length ? (
          <p className="card mt-3 text-stone-600">{m.empty}</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {pending.map((r) => (
              <li key={r.id} className="card">
                <p className="text-xs font-medium text-stone-500">{r.campaign?.product_name} · {r.display_name} · {day(r.created_at)}</p>
                <p className="mt-1 font-semibold">{r.rating}/5{r.title ? ` · ${r.title}` : ""}</p>
                <p className="mt-2 text-sm whitespace-pre-line text-stone-700">{r.body}</p>
                <Photos media={r.review_media} alt={r.campaign?.product_name ?? ""} />
                {r.resubmitted && <p className="mt-3 text-sm font-medium text-amber-800">{m.resubmitted}</p>}
                <form action={moderateReview} className="mt-4">
                  <input type="hidden" name="review_id" value={r.id} />
                  <button name="intent" value="approve" className="btn">{m.approve}</button>
                  <details className="mt-3 border-t border-stone-200 pt-3">
                    <summary className="cursor-pointer py-2 text-sm font-medium text-stone-700">{m.rejectTitle}</summary>
                    <p className="mt-2 text-xs text-stone-500">{m.rule}</p>
                    <label className="label mt-3" htmlFor={`reason-${r.id}`}>{m.reason}</label>
                    <select className="input" id={`reason-${r.id}`} name="reason" defaultValue="">
                      <option value="">{m.chooseReason}</option>
                      {Object.entries(t.rejectionReason).map(([k, label]) => (
                        <option key={k} value={k}>{label}</option>
                      ))}
                    </select>
                    <label className="label mt-3" htmlFor={`note-${r.id}`}>{m.note}</label>
                    <input className="input" id={`note-${r.id}`} name="note" maxLength={500} />
                    <button name="intent" value="reject" className="btn-ghost mt-3">{m.reject}</button>
                  </details>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">{m.published}</h2>
        {!published.length ? (
          <p className="card mt-3 text-stone-600">{m.noPublished}</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {published.map((r) => (
              <li key={r.id} className="card">
                <p className="text-xs font-medium text-stone-500">{r.campaign?.product_name} · {r.display_name}</p>
                <p className="mt-1 font-semibold">{r.rating}/5{r.title ? ` · ${r.title}` : ""}</p>
                <p className="mt-2 text-sm whitespace-pre-line text-stone-700">{r.body}</p>
                <Photos media={r.review_media} alt={r.campaign?.product_name ?? ""} />
                {r.campaign?.external_review_url &&
                  (r.external_confirmed_at ? (
                    <p className="mt-3 text-sm text-teal-900">{m.extConfirmed}</p>
                  ) : r.external_posted_at ? (
                    <form action={confirmExternal} className="mt-3 rounded-lg bg-amber-50 p-3">
                      <input type="hidden" name="review_id" value={r.id} />
                      <p className="text-sm text-amber-900">{m.extPosted}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <button className="btn">{m.extConfirm}</button>
                        <a href={r.campaign.external_review_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand">
                          {t.offer.productLink} ↗
                        </a>
                      </div>
                    </form>
                  ) : (
                    <p className="mt-3 text-sm text-stone-500">{m.extPending}</p>
                  ))}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
