"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, Users } from "lucide-react";
import { useDecisions } from "@/components/decisions-provider";
import { usePreferences } from "@/features/preferences/preferences";
import { DistrictList, PlaceFinder, usePlace } from "@/features/place/place";
import { DecisionCard } from "@/features/decisions/decision-card";
import { MiniMap, type MapPoint } from "@/components/ui/map";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionHeading } from "@/components/ui/section";
import { Chip, ChipRow, FilterChip } from "@/components/ui/chip";
import { Stat } from "@/components/ui/stat";
import { Surface } from "@/components/ui/card";
import { hasCoordinates } from "@/lib/geography";
import { useBoundary } from "@/features/place/boundary";
import { governingBodies, placeCoverage, placeKey, placeMatch, type PlaceDistrict } from "@/lib/place";
import { isOpenStatus } from "@/types";

const CHARLOTTE_CENTER = { latitude: 35.2271, longitude: -80.8431 };

export default function MyAreaPage() {
  const decisions = useDecisions();
  const { preferences, ready } = usePreferences();
  const { place, ready: placeReady } = usePlace();

  /**
   * The districts to match against.
   *
   * A resolved address is authoritative, because it came from the county's own
   * address file. Without one, the reader's chosen ZIP stands in as a single
   * weak district — the same behaviour as before, and labelled as weak.
   */
  const districts = useMemo<PlaceDistrict[]>(() => {
    if (place?.districts.length) return place.districts;
    return preferences.zipCode
      ? [{ kind: "zip", code: preferences.zipCode, label: `ZIP ${preferences.zipCode}` }]
      : [];
  }, [place, preferences.zipCode]);

  const located = useMemo(
    () => decisions.filter((decision) => hasCoordinates(decision.geography)),
    [decisions],
  );

  /**
   * Place matches first, then the reader's own interests.
   *
   * Every card carries the reason it is shown, and a place match always names the
   * district that produced it — so "why am I seeing this" is answerable from the
   * card itself rather than from a preference toggle the reader has forgotten.
   */
  const matches = useMemo(() => {
    const matched: Array<{ decision: (typeof decisions)[number]; reason: string; weight: number }> =
      [];

    for (const decision of decisions) {
      const byPlace = placeMatch(decision, districts);
      if (byPlace) {
        matched.push({ decision, reason: byPlace.reason, weight: byPlace.weight + 1000 });
        continue;
      }
      if (decision.affectedRoles.some((role) => preferences.roles.includes(role))) {
        matched.push({
          decision,
          reason: `It affects people who are ${decision.affectedRoles
            .filter((role) => preferences.roles.includes(role))
            .join(" or ")
            .toLowerCase()}.`,
          weight: 50,
        });
        continue;
      }
      const interest = preferences.interests.find((entry) =>
        decision.topic.toLowerCase().includes(entry.toLowerCase()),
      );
      if (interest) {
        matched.push({ decision, reason: `You follow ${interest}.`, weight: 20 });
      }
    }

    return matched.sort(
      (a, b) => b.weight - a.weight || b.decision.updatedAt.localeCompare(a.decision.updatedAt),
    );
  }, [decisions, districts, preferences]);

  const coverage = useMemo(() => placeCoverage(decisions, districts), [decisions, districts]);

  const placePoints: MapPoint[] = useMemo(() => {
    const points: MapPoint[] = located.map((decision) => ({
      id: decision.id,
      latitude: decision.geography!.latitude!,
      longitude: decision.geography!.longitude!,
      label: decision.geography?.address ?? decision.title,
      href: `/decisions/${decision.slug}`,
      tone: (placeMatch(decision, districts) ? "accent" : "default") as "accent" | "default",
    }));
    if (place) {
      points.push({
        id: "your-place",
        latitude: place.latitude,
        longitude: place.longitude,
        label: `Your address — ${place.matchedAddress}`,
        tone: "accent",
      });
    }
    return points;
  }, [located, districts, place]);

  const center = useMemo(() => {
    if (place) return { latitude: place.latitude, longitude: place.longitude };
    if (!placePoints.length) return CHARLOTTE_CENTER;
    const sum = placePoints.reduce(
      (acc, point) => ({
        latitude: acc.latitude + point.latitude,
        longitude: acc.longitude + point.longitude,
      }),
      { latitude: 0, longitude: 0 },
    );
    return {
      latitude: sum.latitude / placePoints.length,
      longitude: sum.longitude / placePoints.length,
    };
  }, [place, placePoints]);

  const openNearby = matches.filter((entry) => isOpenStatus(entry.decision.status)).length;

  /*
   * Which district outline to draw.
   *
   * Defaults to the city council district, which is the one a reader is most
   * likely to be able to name, falling back to whatever local layer exists. The
   * nested state and federal districts stay one click away rather than being
   * drawn on top of each other.
   */
  const drawable = useMemo(
    () => districts.filter((district) => !["congress", "house", "senate"].includes(district.kind)),
    [districts],
  );
  const [drawnKey, setDrawnKey] = useState<string | null>(null);

  useEffect(() => {
    const preferred = drawable.find((district) => district.kind === "council") ?? drawable[0];
    setDrawnKey(preferred ? placeKey(preferred.kind, preferred.code) : null);
  }, [drawable]);

  const drawnDistrict = useMemo(
    () => drawable.find((district) => placeKey(district.kind, district.code) === drawnKey) ?? null,
    [drawable, drawnKey],
  );
  const boundary = useBoundary(drawnDistrict);

  return (
    <div className="shell py-10 md:py-14">
      <PageHeader
        eyebrow={placeReady && place ? "Your place" : ready ? `ZIP ${preferences.zipCode}` : "Your area"}
        title="What's happening near you."
        description="Matched from the district each official record was resolved to, plus the roles and topics you chose. CivicLens never uses device geolocation."
      />

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Surface className="p-5">
          <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-subtle">
            <Users size={13} className="text-civic" aria-hidden="true" />
            Who decides for this address
          </div>
          {place ? (
            <>
              <p className="mt-3 text-sm leading-6 text-muted">
                Matters here are decided by{" "}
                <b className="text-ink">{governingBodies(districts).join(", ")}</b>.
              </p>
              <div className="mt-4">
                <DistrictList districts={districts} />
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm leading-6 text-muted">
              Enter an address to see the exact districts you live in — city council, county
              commission, school board, and state and federal seats — with whoever currently
              represents each one.
            </p>
          )}
        </Surface>

        <PlaceFinder />
      </div>

      <ChipRow className="mt-6">
        {preferences.roles.map((role) => (
          <Chip key={role}>{role}</Chip>
        ))}
        {preferences.interests.slice(0, 4).map((interest) => (
          <Chip key={interest}>{interest}</Chip>
        ))}
        <Link href="/settings" className="chip font-bold text-civic">
          Edit preferences
        </Link>
      </ChipRow>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Stat value={matches.length} label="Records that touch your place" />
        <Stat value={openNearby} label="Still open to influence" />
        <Stat value={coverage.located} label="Records with a confirmed location" />
      </div>

      {/*
        The honest footnote. A record with no resolved location cannot be shown to
        affect anyone, so the count above is always published beside how much of
        the record set it could even be asked about.
      */}
      <p className="mt-3 text-xs leading-5 text-subtle">
        {coverage.total} records were indexed. {coverage.located} carry a location confirmed against
        an official dataset, so {coverage.unlocated} could not be placed in any district and are
        never claimed to affect yours.
        {place ? ` Your address is in ${districts.length} mapped districts.` : ""}
      </p>

      {placePoints.length ? (
        <section className="mt-10">
          <SectionHeading
            eyebrow="Geography"
            title="On the map"
            description="Every pin comes from an official geospatial dataset. Amber pins are in your districts."
          />
          {drawable.length > 1 ? (
            <ChipRow className="mb-3">
              {drawable.map((district) => {
                const key = placeKey(district.kind, district.code);
                return (
                  <FilterChip
                    key={key}
                    active={key === drawnKey}
                    onClick={() => setDrawnKey(key)}
                  >
                    {district.label}
                  </FilterChip>
                );
              })}
            </ChipRow>
          ) : null}

          <MiniMap
            center={center}
            points={placePoints}
            shapes={boundary.shape ? [boundary.shape] : []}
            height={420}
            zoom={place ? 13 : placePoints.length === 1 ? 15 : 11}
          />

          {/*
            The honesty line under the map. A district with no published outline
            says so, because a blank map otherwise reads as "nothing here".
          */}
          <p className="mt-2 text-xs leading-5 text-subtle">
            {boundary.status === "loading" ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" /> Loading the district outline…
              </span>
            ) : boundary.status === "ready" ? (
              <>
                The outlined area is {drawnDistrict?.label}. Pins are records located inside your
                districts, amber ones within this outline.
              </>
            ) : boundary.status === "absent" ? (
              <>{boundary.note}</>
            ) : boundary.status === "error" ? (
              <>{boundary.note} Pins are unaffected.</>
            ) : (
              <>Pins are records the county&apos;s own data could place at an address.</>
            )}
          </p>
          <p className="mt-1 text-xs text-subtle">
            Map data © OpenStreetMap contributors. District outlines come from the county&apos;s
            geospatial server; location matching is described on each record page under &ldquo;How we
            know this&rdquo;.
          </p>
        </section>
      ) : (
        <div className="mt-10">
          <EmptyState
            icon={<MapPin />}
            title="No mapped locations yet"
            body="Geography arrives once records are matched against the official rezoning dataset. Run the geography enrichment job to populate it."
            action={
              <Link href="/explore" className="btn btn-secondary">
                Browse all decisions
              </Link>
            }
          />
        </div>
      )}

      <section className="mt-12">
        <SectionHeading
          eyebrow="Matched"
          title={place ? "Decisions that touch your place" : "Decisions that match your preferences"}
          description="Ordered by how tightly each record matches, with the reason shown on every card."
          actionHref="/explore"
          actionLabel="View everything"
        />
        {matches.length ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {matches.slice(0, 12).map(({ decision, reason }) => (
              <DecisionCard key={decision.id} decision={decision} reason={reason} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nothing matches your place yet"
            body={
              place
                ? "No located record falls in your districts. That is a real result: most records carry no location the county has published."
                : "Enter your address, or widen your topics, to see what applies to you."
            }
            action={
              <>
                <Link href="/settings" className="btn btn-secondary">
                  Edit preferences
                </Link>
                <Link href="/explore" className="btn btn-primary">
                  Explore decisions
                </Link>
              </>
            }
          />
        )}
      </section>
    </div>
  );
}
