import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { syncPages } from "@/lib/sync";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** POST { pageIds: string[], full?: boolean } */
export async function POST(req: Request) {
  if (!(await getUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { pageIds, full } = await req.json().catch(() => ({}));
  if (!Array.isArray(pageIds) || !pageIds.length)
    return NextResponse.json({ error: "pageIds required" }, { status: 400 });
  const results = await syncPages(pageIds.map(String), { source: "api", full: !!full });
  return NextResponse.json({ results });
}
