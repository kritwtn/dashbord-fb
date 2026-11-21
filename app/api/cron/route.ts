import { NextResponse } from "next/server";
import { syncPages } from "@/lib/sync";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Daily auto-sync of all enabled pages. Requires `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends it). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const results = await syncPages("enabled", { source: "cron" });
  return NextResponse.json({ results });
}
