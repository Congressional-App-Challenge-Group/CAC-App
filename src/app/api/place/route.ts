import { NextResponse } from "next/server";
import { lookupPlace, nearestPlace } from "@/server/place";

export const dynamic = "force-dynamic";

/**
 * Resolve a typed address to the districts that contain it.
 *
 * The address is looked up against Mecklenburg County's own Master Address
 * Points file, so the answer cites the government's record rather than a
 * commercial geocoder's interpolation. A POST body is used rather than a query
 * string so a reader's home address does not end up in access logs.
 */
export async function POST(request: Request) {
  let body: { address?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, reason: "unparsed", message: "That request could not be read." },
      { status: 400 },
    );
  }

  const address = typeof body?.address === "string" ? body.address.trim() : "";
  if (!address) {
    return NextResponse.json(
      { ok: false, reason: "unparsed", message: "Enter a street address to look up." },
      { status: 400 },
    );
  }

  // "We could not find that address" is an answer, not a server error, so it
  // comes back as 200 with a reason the interface can explain in full.
  return NextResponse.json(await lookupPlace(address));
}

/**
 * Device-position lookup, opt-in only from the UI, and anchored to the county's
 * own address file (see nearestPlace). Coordinates arrive in a POST body rather
 * than a query string so they stay out of access logs, and are never stored.
 */
export async function PUT(request: Request) {
  let body: { latitude?: unknown; longitude?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, reason: "unparsed", message: "That request could not be read." },
      { status: 400 },
    );
  }
  const latitude = typeof body?.latitude === "number" ? body.latitude : Number.NaN;
  const longitude = typeof body?.longitude === "number" ? body.longitude : Number.NaN;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json(
      { ok: false, reason: "unparsed", message: "A usable device position was not provided." },
      { status: 400 },
    );
  }
  return NextResponse.json(await nearestPlace(latitude, longitude));
}
