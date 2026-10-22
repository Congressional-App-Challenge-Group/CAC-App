import { NextResponse } from "next/server";
import { getRecentChanges } from "@/server/decisions";

/**
 * Recent change log for client-side pages that must not become a server
 * component (the watchlist is interactive). Read-only, bounded, and identical
 * to the /changes feed's data source, so the two surfaces can never disagree
 * about what "moved" means. Failures degrade to an empty list; the Following
 * card treats "unknown" as "no claim", never as zero.
 */
export const revalidate = 300;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? "60");
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, Math.floor(rawLimit)), 200) : 60;
  const rawDays = Number(url.searchParams.get("days") ?? "30");
  const days = Number.isFinite(rawDays) ? Math.min(Math.max(1, Math.floor(rawDays)), 365) : 30;

  try {
    const changes = await getRecentChanges({ days, limit });
    return NextResponse.json({ ok: true, changes });
  } catch (error) {
    console.error("[api/changes/recent] read failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, changes: [] }, { status: 200 });
  }
}
