import { AdminNotice } from "@/components/admin-notice";
import { Stars } from "@/components/stars";
import { createClient } from "@/lib/supabase/server";
import { day, reviewPhotoUrl } from "@/lib/format";
import { t } from "@/lib/i18n/hr";
import { setReviewVisibility } from "../actions";

export const metadata = { title: t.admin.tabs.reviews };

type Media = { storage_path: string; position: number; removed_at: string | null };

export default async function AdminReviewsPage({ searchParams }: PageProps<"/admin/recenzije">) {
  const sp = await searchParams;
  const a = t.admin.reviews;
  const supabase = await createClient();
  const { data: reviews } = await supabase
    .from("reviews")
    .select("id, status, rating, title, body, display_name, rejection_note, created_at, campaigns(product_name), brands(name), review_media(storage_path, position, removed_at)")
    .in("status", ["approved", "flagged"])
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="max-w-3xl">
      <AdminNotice sp={sp} />
      <p className="mb-4 text-sm text-ink/65">{a.rule}</p>
      {!reviews?.length && <p className="card text-sm text-ink/65">{a.empty}</p>}
      <ul className="space-y-4">
        {(reviews ?? []).map((r) => {
          const c = Array.isArray(r.campaigns) ? r.campaigns[0] : r.campaigns;
          const b = Array.isArray(r.brands) ? r.brands[0] : r.brands;
          const photos = (r.review_media as Media[]).filter((m) => !m.removed_at).sort((x, y) => x.position - y.position);
          const hidden = r.status === "flagged";
          return (
            <li key={r.id} className={`card ${hidden ? "border-dashed opacity-80" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-xs font-semibold text-ink/55">{b?.name} · {c?.product_name} · {r.display_name} · {day(r.created_at)}</p>
                {hidden && <span className="rounded-full bg-ink px-3 py-1 text-xs font-bold text-white">{a.hidden}</span>}
              </div>
              <p className="mt-1 text-lg"><Stars rating={r.rating} /></p>
              {r.title && <p className="font-bold">{r.title}</p>}
              <p className="mt-2 text-sm whitespace-pre-line text-ink/80">{r.body}</p>
              {photos.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {photos.map((m) => (
                    <a key={m.storage_path} href={reviewPhotoUrl(m.storage_path)} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- slike iz Supabase Storagea */}
                      <img src={reviewPhotoUrl(m.storage_path)} alt={c?.product_name ?? ""} loading="lazy" className="h-24 w-24 rounded-xl object-cover" />
                    </a>
                  ))}
                </div>
              )}
              {hidden && r.rejection_note && <p className="mt-3 text-sm text-ink/65">{a.hideNote}: {r.rejection_note}</p>}
              <form action={setReviewVisibility} className="mt-4 flex flex-wrap items-end gap-3 border-t border-stone-200 pt-4">
                <input type="hidden" name="review_id" value={r.id} />
                {hidden ? (
                  <button name="intent" value="restore" className="btn-ghost">{a.restore}</button>
                ) : (
                  <>
                    <div className="min-w-48 flex-1">
                      <label className="label" htmlFor={`n-${r.id}`}>{a.hideNote}</label>
                      <input className="input" id={`n-${r.id}`} name="note" maxLength={500} />
                    </div>
                    <button name="intent" value="hide" className="btn-ghost">{a.hide}</button>
                  </>
                )}
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
