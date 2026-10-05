"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { t } from "@/lib/i18n/hr";

type Props = {
  bucket: "review-media" | "purchase-proofs";
  /** Naziv skrivenog polja forme; svaka učitana datoteka dodaje jedno polje s putanjom. */
  name: string;
  userId: string;
  accept: string;
  max: number;
  /** Fotografije se prije slanja smanjuju na najviše 1600 px (manji prijenos s mobitela). */
  resize?: boolean;
  id: string;
};

type Uploaded = { path: string; label: string; preview?: string };

const MAX_BYTES = 5 * 1024 * 1024;

async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.85),
  );
}

export function FileUploader({ bucket, name, userId, accept, max, resize, id }: Props) {
  const [files, setFiles] = useState<Uploaded[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    setError(null);
    if (files.length + picked.length > max) {
      setError(t.upload.limit(max));
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const added: Uploaded[] = [];
    try {
      for (const file of picked) {
        const isImage = file.type.startsWith("image/");
        const body = resize && isImage ? await shrink(file) : file;
        if (body.size > MAX_BYTES) {
          setError(t.upload.tooBig);
          continue;
        }
        const ext = resize && isImage ? "jpg" : (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(bucket)
          .upload(path, body, { contentType: resize && isImage ? "image/jpeg" : file.type });
        if (upErr) {
          setError(t.upload.failed);
          continue;
        }
        added.push({ path, label: file.name, preview: isImage ? URL.createObjectURL(body) : undefined });
      }
    } catch {
      setError(t.upload.failed);
    } finally {
      setFiles((prev) => [...prev, ...added]);
      setBusy(false);
    }
  }

  return (
    <div>
      {files.map((f) => (
        <input key={f.path} type="hidden" name={name} value={f.path} />
      ))}
      {files.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-3">
          {files.map((f) => (
            <li key={f.path} className="w-24 text-center">
              {f.preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- lokalni pregled prije slanja
                <img src={f.preview} alt={f.label} className="h-24 w-24 rounded-lg border border-stone-200 object-cover" />
              ) : (
                <span className="flex h-24 w-24 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 p-1 text-xs break-all text-stone-600">
                  {f.label}
                </span>
              )}
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((x) => x.path !== f.path))}
                className="mt-1 min-h-8 text-xs font-medium text-red-700"
              >
                {t.upload.remove}
              </button>
            </li>
          ))}
        </ul>
      )}
      {files.length < max && (
        <label htmlFor={id} className={`btn-ghost cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {busy ? t.upload.uploading : max > 1 ? t.upload.choosePhotos : t.upload.choose}
          <input id={id} type="file" accept={accept} multiple={max > 1} onChange={onChange} disabled={busy} className="sr-only" />
        </label>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
