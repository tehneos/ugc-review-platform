import { createClient as createAnonClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { reviewPhotoUrl } from "@/lib/format";

type Feed = {
  error?: string;
  reviews?: { photos: string[] }[];
};

/** Javni izvor podataka za widget.js: samo odobrene recenzije jednog widgeta. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/widget/[publicKey]">) {
  const { publicKey } = await ctx.params;
  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  let host: string | null = null;
  try {
    host = origin ? new URL(origin).hostname : null;
  } catch {}

  // Prijavljen član brenda (pregled u dashboardu) ide sa sesijom i bez javnog cachea.
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  const supabase = hasSession
    ? await createSessionClient()
    : createAnonClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
        auth: { persistSession: false },
      });

  const { data, error } = await supabase.rpc("get_widget_feed", { p_public_key: publicKey, p_host: host });
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    Vary: "Origin, Cookie",
    "Cache-Control": hasSession ? "private, no-store" : "public, s-maxage=300, stale-while-revalidate=600",
  };

  const feed = data as Feed | null;
  if (error) return Response.json({ error: "UNAVAILABLE" }, { status: 502, headers: { ...headers, "Cache-Control": "no-store" } });
  if (!feed) return Response.json({ error: "NOT_FOUND" }, { status: 404, headers });
  if (feed.error) return Response.json(feed, { status: 403, headers });

  for (const r of feed.reviews ?? []) r.photos = r.photos.map(reviewPhotoUrl);
  return Response.json(feed, { headers });
}
