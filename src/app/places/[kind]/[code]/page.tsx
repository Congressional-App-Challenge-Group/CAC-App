import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, MapPin } from "lucide-react";
import { getDecisions } from "@/server/decisions";
import { loadPlaceBoundaries } from "@/server/place";
import {
  boundsOfRings,
  decisionPlaceCodes,
  parsePlaceKey,
  placeKey,
  placeKindMeta,
  placeLabel,
  type PlaceKind,
} from "@/lib/place";
import { MiniMap, type MapPoint } from "@/components/ui/map";
import { hasCoordinates } from "@/lib/geography";
import { FollowPlaceButton } from "@/features/place/follow";
import { DecisionCard } from "@/features/decisions/decision-card";
import { PageHeader, SectionHeading } from "@/components/ui/section";
import { Surface } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/empty-state";
import { isDecidedStatus, isOpenStatus } from "@/types";

export const revalidate = 300;

/**
 * A district, as a page.
 *
 * This is the piece that makes a district a *place* rather than a filter: it has
 * an address a neighbour can be sent, it lists everything the government has
 * published for that district, and it can be followed.
 *
 * Like every other surface, it reports what it can see rather than what it
 * wishes it could. A district's page says how many of the indexed records were
 * located at all, because a decision with no resolved location cannot be placed
 * in any district — including this one — and a bare list of six items would
 * otherwise read as "six things happened here".
 */
/**
 * The URL is two segments — `/places/council/2` — rather than the `council:2` key
 * the store uses.
 *
 * A colon in a path segment does not survive Next's routing, which 404s the page
 * before any of this code runs. Splitting the key keeps the stored form and the
 * shared form identical in meaning while giving a URL a person can read aloud.
 */
function parseKindCode(kind: string, code: string): { kind: PlaceKind; code: string } | null {
  return parsePlaceKey(`${decodeURIComponent(kind)}:${decodeURIComponent(code)}`);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ kind: string; code: string }>;
}): Promise<Metadata> {
  const { kind, code } = await params;
  const parsed = parseKindCode(kind, code);
  if (!parsed) return { title: "District not found" };
  const label = placeLabel(parsed.kind, parsed.code);
  return {
    title: `${label} — decisions`,
    description: `Everything CivicLens has indexed for ${label}, from the official government records.`,
  };
}

export default async function PlacePage({
  params,
}: {
  params: Promise<{ kind: string; code: string }>;
}) {
  const { kind, code } = await params;
  const parsed = parseKindCode(kind, code);
  if (!parsed) notFound();

  const [decisions, { boundaries }] = await Promise.all([getDecisions(), loadPlaceBoundaries()]);

  const boundary = boundaries.find(
    (entry) => entry.kind === parsed.kind && entry.code === parsed.code,
  );
  const label = boundary?.label ?? placeLabel(parsed.kind, parsed.code);
  const meta = placeKindMeta[parsed.kind];

  const inside = decisions.filter(
    (decision) => decisionPlaceCodes(decision.geography)[parsed.kind] === parsed.code,
  );

  const located = decisions.filter(
    (decision) => Object.keys(decisionPlaceCodes(decision.geography)).length > 0,
  ).length;

  /** The records listed below that the map can actually place. */
  const locatedInside = inside.filter((decision) => hasCoordinates(decision.geography));

  const open = inside.filter((decision) => isOpenStatus(decision.status));
  const decided = inside.filter((decision) => isDecidedStatus(decision.status));

  /*
   * The district's own outline, with the decisions inside it as pins.
   *
   * The pins are exactly the records this page lists, so the two can never
   * disagree: both come from the same district code resolved out of the county's
   * boundary layer. The map centre is the outline's own bounding box rather than
   * a guess, and a district with no published geometry shows no map at all.
   */
  const bounds = boundary ? boundsOfRings(boundary.rings) : null;
  const pins: MapPoint[] = locatedInside.map((decision) => ({
    id: decision.id,
    latitude: decision.geography!.latitude!,
    longitude: decision.geography!.longitude!,
    label: decision.geography?.address ?? decision.title,
    href: `/decisions/${decision.slug}`,
  }));
  const mapCenter = bounds
    ? {
        latitude: (bounds.minLatitude + bounds.maxLatitude) / 2,
        longitude: (bounds.minLongitude + bounds.maxLongitude) / 2,
      }
    : null;

  return (
    <div className="shell py-8 md:py-12">
      <Link
        href="/my-area"
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-extrabold text-civic transition-colors hover:bg-surface-3"
      >
        <ArrowLeft size={16} />
        My area
      </Link>

      <div className="mt-7">
        <PageHeader
          eyebrow={meta.name}
          title={label}
          description={meta.governs}
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-10">
          <section>
            <SectionHeading
              eyebrow="Open now"
              title={`${open.length} open ${open.length === 1 ? "item" : "items"} in this district`}
              description="Still open for input, under review, or heading to a vote."
            />
            {open.length ? (
              <div className="grid gap-5 md:grid-cols-2">
                {open.slice(0, 12).map((decision) => (
                  <DecisionCard
                    key={decision.id}
                    decision={decision}
                    reason={`It is in ${label}.`}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Nothing open in this district"
                body="No indexed record with a confirmed location in this district is awaiting a decision right now."
              />
            )}
          </section>

          <section>
            <SectionHeading
              eyebrow="Decided"
              title={`${decided.length} decided ${decided.length === 1 ? "item" : "items"}`}
              description="What the official record now shows as decided, funded, or complete."
            />
            {decided.length ? (
              <div className="grid gap-5 md:grid-cols-2">
                {decided.slice(0, 6).map((decision) => (
                  <DecisionCard
                    key={decision.id}
                    decision={decision}
                    reason={`It is in ${label}.`}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No decided items yet"
                body="No indexed record in this district has been decided yet. Check back soon for updates."
              />
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {mapCenter && pins.length ? (
            <section>
              <SectionHeading eyebrow="Where" title="This district on the map" />
              <MiniMap
                center={mapCenter}
                zoom={11}
                points={pins}
                shapes={[
                  {
                    id: placeKey(parsed.kind, parsed.code),
                    rings: boundary!.rings,
                    label,
                  },
                ]}
                height={260}
                interactive={false}
              />
              <p className="mt-2 text-xs leading-5 text-subtle">
                {pins.length} of the {inside.length} records listed here could be placed at an
                address inside this outline. The shape is the county&apos;s own boundary.
              </p>
            </section>
          ) : null}

          <Surface className="p-5 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 font-extrabold text-ink">
                <MapPin size={17} className="text-civic" aria-hidden="true" />
                {label}
              </div>
              <FollowPlaceButton district={{ kind: parsed.kind, code: parsed.code, label }} />
            </div>

            <p className="mt-3 leading-6 text-muted">
              {meta.body} decides matters in this district. Following it puts every matter that lands
              here on your list.
            </p>

            {boundary?.rep ? (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-subtle">
                  Holds this seat
                </p>
                <p className="mt-1.5 font-bold text-ink">{boundary.rep}</p>
                {boundary.email ? (
                  <a
                    href={`mailto:${boundary.email}`}
                    className="mt-1 inline-flex items-center gap-1.5 break-all text-xs font-extrabold text-civic hover:text-civic-strong"
                  >
                    <Mail size={12} aria-hidden="true" />
                    {boundary.email}
                  </a>
                ) : (
                  <p className="mt-1 text-xs leading-5 text-subtle">
                    The county publishes no address for this seat, so no email is offered.
                  </p>
                )}
              </div>
            ) : null}

            {boundary?.sourceUrl ? (
              <a
                href={boundary.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="btn btn-secondary mt-4 w-full text-sm"
              >
                Official boundary source
              </a>
            ) : null}
          </Surface>

          <div className="grid grid-cols-2 gap-3">
            <Stat value={inside.length} label="In this district" />
            <Stat value={located} label="Located at all" />
          </div>

          {/*
            The honest denominator. A reader who sees "3 items here" should be able
            to tell whether that is because the district is quiet or because the
            records were never placed.
          */}
          <Surface className="p-5 text-xs leading-5 text-subtle">
            CivicLens can place {located} of {decisions.length} indexed records in a district.
            The rest state no location the county&apos;s parcel data could confirm, so they appear
            on no district page — this one included.
          </Surface>
        </aside>
      </div>
    </div>
  );
}
