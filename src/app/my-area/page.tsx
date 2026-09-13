"use client";

import Link from "next/link";
import { useMemo } from "react";
import { MapPin } from "lucide-react";
import { useDecisions } from "@/components/decisions-provider";
import { usePreferences } from "@/features/preferences/preferences";
import { DecisionCard } from "@/features/decisions/decision-card";
import { MiniMap, type MapPoint } from "@/components/ui/map";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionHeading } from "@/components/ui/section";
import { Chip, ChipRow } from "@/components/ui/chip";
import { Stat } from "@/components/ui/stat";
import { hasCoordinates } from "@/lib/geography";

const CHARLOTTE_CENTER = { latitude: 35.2271, longitude: -80.8431 };

export default function MyAreaPage() {
  const decisions = useDecisions();
  const { preferences, ready } = usePreferences();

  const matches = useMemo(
    () =>
      decisions.filter(
        (decision) =>
          decision.geography?.zipCode === preferences.zipCode ||
          decision.affectedZipCodes.includes(preferences.zipCode) ||
          decision.affectedRoles.some((role) => preferences.roles.includes(role)) ||
          preferences.interests.some((interest) =>
            decision.topic.toLowerCase().includes(interest.toLowerCase()),
          ),
      ),
    [decisions, preferences],
  );

  const located = useMemo(
    () => decisions.filter((decision) => hasCoordinates(decision.geography)),
    [decisions],
  );

  const points: MapPoint[] = useMemo(
    () =>
      located.map((decision) => ({
        id: decision.id,
        latitude: decision.geography!.latitude!,
        longitude: decision.geography!.longitude!,
        label: decision.geography?.address ?? decision.title,
        href: `/decisions/${decision.slug}`,
        tone: decision.geography?.zipCode === preferences.zipCode ? "accent" : "default",
      })),
    [located, preferences.zipCode],
  );

  const center = useMemo(() => {
    if (!points.length) return CHARLOTTE_CENTER;
    const sum = points.reduce(
      (acc, point) => ({
        latitude: acc.latitude + point.latitude,
        longitude: acc.longitude + point.longitude,
      }),
      { latitude: 0, longitude: 0 },
    );
    return { latitude: sum.latitude / points.length, longitude: sum.longitude / points.length };
  }, [points]);

  const inYourZip = decisions.filter(
    (decision) => decision.geography?.zipCode === preferences.zipCode,
  ).length;

  return (
    <div className="shell py-10 md:py-14">
      <PageHeader
        eyebrow={ready ? `ZIP ${preferences.zipCode}` : "Your area"}
        title="What's happening near you."
        description="Matched from the location on each official record, plus the roles and topics you chose. CivicLens never uses precise location tracking or device geolocation."
      />

      <ChipRow className="mt-6">
        {preferences.roles.map((role) => (
          <Chip key={role}>{role}</Chip>
        ))}
        {preferences.interests.slice(0, 4).map((interest) => (
          <Chip key={interest}>{interest}</Chip>
        ))}
        <Link
          href="/settings"
          className="chip font-bold text-civic"
        >
          Edit preferences
        </Link>
      </ChipRow>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Stat value={matches.length} label="Matching records" />
        <Stat value={inYourZip} label={`In ZIP ${preferences.zipCode}`} />
        <Stat value={located.length} label="Records with a mapped location" />
      </div>

      {points.length ? (
        <section className="mt-10">
          <SectionHeading
            eyebrow="Geography"
            title="On the map"
            description="Pins come from an official geospatial dataset. Amber pins fall in your ZIP code."
          />
          <MiniMap
            center={center}
            points={points}
            height={420}
            zoom={points.length === 1 ? 15 : 11}
          />
          <p className="mt-2 text-xs text-subtle">
            Map data © OpenStreetMap contributors. Location matching is described on each record
            page under &ldquo;How we know this&rdquo;.
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
          title="Decisions that touch your area"
          description="Ranked by how closely each record matches your ZIP, roles, and topics."
          actionHref="/explore"
          actionLabel="View everything"
        />
        {matches.length ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {matches.map((decision) => (
              <DecisionCard
                key={decision.id}
                decision={decision}
                reason={
                  decision.geography?.zipCode === preferences.zipCode
                    ? `It is in your ZIP code (${preferences.zipCode}).`
                    : undefined
                }
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nothing matches your preferences yet"
            body="Try widening your topics, or explore every tracked record."
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
