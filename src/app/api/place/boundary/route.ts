import { NextResponse } from "next/server";
import { loadPlaceBoundaries } from "@/server/place";
import { parsePlaceKey } from "@/lib/place";
import type { PolygonRings } from "@/lib/geography";

export const dynamic = "force-dynamic";

/**
 * One district's outline, served on demand so the map can draw it.
 *
 * The browser never receives the whole boundary set: it is 84 polygons and about
 * half a megabyte, and a page draws one or two of them. This route also reports
 * the two ways a district can have no outline — an unknown key, and a real
 * district the county publishes no geometry for — as distinct answers, because a
 * blank map should say which one happened.
 */

/** Keeps a single outline inside a sane payload without visibly changing it. */
const MAX_VERTICES = 4000;

function thin(rings: PolygonRings): PolygonRings {
  const total = rings.reduce((sum, ring) => sum + ring.length, 0);
  if (total <= MAX_VERTICES) return rings;
  const stride = Math.ceil(total / MAX_VERTICES);
  return rings.map((ring) => ring.filter((_, index) => index % stride === 0));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "";
  const code = url.searchParams.get("code") ?? "";

  const parsed = parsePlaceKey(`${kind}:${code}`);
  if (!parsed) {
    return NextResponse.json(
      { ok: false, reason: "unknown-district", message: "That is not a district CivicLens knows." },
      { status: 400 },
    );
  }

  const { boundaries, generatedAt, source } = await loadPlaceBoundaries();
  const boundary = boundaries.find(
    (entry) => entry.kind === parsed.kind && entry.code === parsed.code,
  );

  if (!boundary) {
    // A district page can be linked from a record that names the district while
    // the county publishes no polygon for it. That is a gap in the source, not a
    // bad request, so it comes back as an answer rather than an error.
    return NextResponse.json({
      ok: false,
      reason: "no-boundary",
      kind: parsed.kind,
      code: parsed.code,
      message: `The county publishes no outline for ${parsed.kind} district ${parsed.code}.`,
    });
  }

  return NextResponse.json({
    ok: true,
    kind: boundary.kind,
    code: boundary.code,
    label: boundary.label,
    rep: boundary.rep ?? null,
    rings: thin(boundary.rings),
    sourceUrl: boundary.sourceUrl,
    generatedAt,
    source,
  });
}
