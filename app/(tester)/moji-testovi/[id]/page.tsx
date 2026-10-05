import Link from "next/link";
import { notFound } from "next/navigation";
import { FileUploader } from "@/components/file-uploader";
import { requireTester } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { day } from "@/lib/format";
import { t } from "@/lib/i18n/hr";
import { CopyButton } from "@/components/copy-button";
import { confirmReceived, markExternalPosted, submitProof, submitReview } from "../actions";

export default async function TestPage({ params, searchParams }: PageProps<"/moji-testovi/[id]">) {
  const profile = await requireTester();
  const { id } = await params;
  const sp = await searchParams;
  const x = t.test;

  const supabase = await createClient();
  const { data: o } = await supabase
    .from("orders")
    .select(
      "id, status, coupon_code, external_order_number, rejection_note, tracking_number, shipped_at, purchase_due_at, review_due_at, campaigns(product_name, product_url, fulfillment_mode, min_photos, purchase_instructions, external_review_url, brands(name))",
    )
    .eq("id", id)
    .eq("tester_id", profile.id)
    .maybeSingle();
  if (!o) notFound();

  const c = Array.isArray(o.campaigns) ? o.campaigns[0] : o.campaigns;
  const brand = c && (Array.isArray(c.brands) ? c.brands[0] : c.brands);
  const ships = c?.fulfillment_mode === "brand_ships";
  const { data: review } = await supabase
    .from("reviews")
    .select("id, status, rating, title, body, rejection_reason, rejection_note, resubmitted, external_posted_at, external_confirmed_at")
    .eq("order_id", o.id)
    .maybeSingle();
  const errorKey = typeof sp.greska === "string" ? sp.greska : null;

  return (
    <div className="max-w-xl">
      <Link href="/moji-testovi" className="text-sm font-medium text-brand">← {x.back}</Link>
      <p className="mt-3 text-sm font-medium text-stone-500">{brand?.name}</p>
      <h1 className="text-2xl font-bold">{c?.product_name}</h1>
      <p className="mt-2 inline-block rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
        {t.orderStatus[o.status] ?? o.status}
      </p>

      {errorKey && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {x.errors[errorKey] ?? t.auth.errors.generic}
        </p>
      )}

      {o.status === "claimed" && !ships && (
        <section className="card mt-6 space-y-4">
          {o.coupon_code && (
            <p className="text-sm">
              {t.order.coupon}: <code className="rounded bg-teal-50 px-2 py-1 font-mono font-semibold text-teal-900">{o.coupon_code}</code>
            </p>
          )}
          <p className="text-sm font-medium">{t.order.buyBy(day(o.purchase_due_at))}</p>
          {c?.purchase_instructions && <p className="text-sm whitespace-pre-line text-stone-700">{c.purchase_instructions}</p>}
          {c?.product_url && (
            <a href={c.product_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-block text-sm font-medium text-brand">
              {t.offer.productLink} ↗
            </a>
          )}
          {o.rejection_note && (
            <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              {x.proofRejected} {o.rejection_note}
            </p>
          )}
          <form action={submitProof} className="space-y-4 border-t border-stone-200 pt-4">
            <input type="hidden" name="order_id" value={o.id} />
            <h2 className="font-semibold">{x.proofTitle}</h2>
            <p className="text-sm text-stone-600">{x.proofHint}</p>
            <div>
              <label className="label" htmlFor="order_number">{x.orderNumber}</label>
              <input className="input" id="order_number" name="order_number" maxLength={80} defaultValue={o.external_order_number ?? ""} />
            </div>
            <div>
              <span className="label">{x.proofFile}</span>
              <FileUploader id="proof" bucket="purchase-proofs" name="proof_path" userId={profile.id} accept="image/jpeg,image/png,image/webp,application/pdf" max={1} />
            </div>
            <button className="btn">{x.submitProof}</button>
          </form>
        </section>
      )}

      {o.status === "claimed" && ships && (
        <section className="card mt-6 space-y-3">
          {!o.shipped_at ? (
            <p className="text-sm text-stone-700">{t.order.waitingShipment}</p>
          ) : (
            <>
              <p className="text-sm text-stone-700">{x.shipped}</p>
              {o.tracking_number && <p className="text-sm">{x.tracking}: <code className="font-mono">{o.tracking_number}</code></p>}
              <form action={confirmReceived}>
                <input type="hidden" name="order_id" value={o.id} />
                <button className="btn">{x.confirmReceived}</button>
                <p className="mt-2 text-xs text-stone-500">{x.receivedHint}</p>
              </form>
            </>
          )}
        </section>
      )}

      {o.status === "purchase_submitted" && <p className="card mt-6 text-sm text-stone-700">{x.waitingVerify}</p>}

      {o.status === "purchase_verified" && (
        <section className="card mt-6">
          <h2 className="font-semibold">{x.reviewTitle}</h2>
          {o.review_due_at && <p className="mt-1 text-sm font-medium text-stone-800">{t.order.reviewBy(day(o.review_due_at))}</p>}
          {review?.status === "rejected" && (
            <div role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              <p>{x.reviewRejected}</p>
              <p className="mt-1">
                {x.reason}: {review.rejection_reason ? t.rejectionReason[review.rejection_reason] : ""}
                {review.rejection_note ? ` (${review.rejection_note})` : ""}
              </p>
            </div>
          )}
          <form action={submitReview} className="mt-4 space-y-4">
            <input type="hidden" name="order_id" value={o.id} />
            <fieldset>
              <legend className="label">{x.rating}</legend>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-stone-300 bg-white font-semibold has-checked:border-brand has-checked:bg-brand has-checked:text-white">
                    <input type="radio" name="rating" value={n} required defaultChecked={review?.rating === n} className="sr-only" />
                    {n}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <label className="label" htmlFor="title">{x.title}</label>
              <input className="input" id="title" name="title" maxLength={120} defaultValue={review?.title ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="body">{x.body}</label>
              <textarea className="input py-2" id="body" name="body" rows={6} required minLength={30} maxLength={3000} defaultValue={review?.body ?? ""} aria-describedby="body-hint" />
              <p id="body-hint" className="mt-1 text-xs text-stone-500">{x.bodyHint}</p>
            </div>
            <div>
              <span className="label">{x.photos(c?.min_photos ?? 1)}</span>
              <FileUploader id="photos" bucket="review-media" name="photo_path" userId={profile.id} accept="image/jpeg,image/png,image/webp" max={3} resize />
            </div>
            {!profile.media_consent_at && (
              <label className="flex items-start gap-2 text-sm text-stone-700">
                <input type="checkbox" name="media_consent" required className="mt-1" />
                {x.consent}
              </label>
            )}
            <p className="text-xs text-stone-500">{x.disclosure}</p>
            <button className="btn">{x.submitReview}</button>
          </form>
        </section>
      )}

      {o.status === "review_submitted" && <p className="card mt-6 text-sm text-stone-700">{x.reviewPending}</p>}
      {o.status === "completed" && <p className="card mt-6 text-sm text-teal-900">{x.completed}</p>}

      {o.status === "completed" && review?.status === "approved" && c?.external_review_url && (
        <section className="card mt-6">
          <h2 className="font-semibold">{x.extTitle}</h2>
          {review.external_confirmed_at ? (
            <p className="mt-2 text-sm text-teal-900">{x.extConfirmed}</p>
          ) : review.external_posted_at ? (
            <p className="mt-2 text-sm text-stone-700">{x.extWaiting}</p>
          ) : (
            <>
              <p className="mt-2 text-sm text-stone-700">{x.extIntro}</p>
              <p className="mt-3 rounded-lg bg-stone-50 p-3 text-sm whitespace-pre-line text-stone-800 select-all">
                {`${review.body}\n\n${x.extDisclosure}`}
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <CopyButton text={`${review.body}\n\n${x.extDisclosure}`} label={x.extCopy} copiedLabel={x.extCopied} />
                <a href={c.external_review_url} target="_blank" rel="noopener noreferrer nofollow" className="btn-ghost">
                  {x.extOpen} ↗
                </a>
              </div>
              <form action={markExternalPosted} className="mt-4 border-t border-stone-200 pt-4">
                <input type="hidden" name="order_id" value={o.id} />
                <input type="hidden" name="review_id" value={review.id} />
                <button className="btn">{x.extDone}</button>
              </form>
            </>
          )}
        </section>
      )}
      {o.status === "expired" && <p className="card mt-6 text-sm text-stone-700">{x.expired}</p>}
      {o.status === "rejected" && (
        <p className="card mt-6 text-sm text-stone-700">
          {x.finalRejected}
          {review?.rejection_reason ? ` ${x.reason}: ${t.rejectionReason[review.rejection_reason]}` : ""}
        </p>
      )}
    </div>
  );
}
