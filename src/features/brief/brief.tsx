"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Activity, Info } from "lucide-react";
import { useDecisions } from "@/components/decisions-provider";
import { usePreferences } from "@/features/preferences/preferences";
import { DecisionCard } from "@/features/decisions/decision-card";
import { ChangeCard } from "@/features/changes/change-card";
import { groupChangesByDecision } from "@/lib/changes";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import type { Decision, DecisionChange, UserPreferences } from "@/types";

const OPEN_STATUSES: Decision["status"][] = ["Public feedback", "Under review", "Scheduled for vote", "Proposed"];
const CLOSED_STATUSES: Decision["status"][] = ["Approved", "Funded", "Implementation", "Completed", "Rejected"];

/** Explain why a record surfaced, so personalization is visible rather than magic. */
function reasonFor(decision: Decision, preferences: UserPreferences): string | undefined {
  const zip = decision.geography?.zipCode;
  if (zip && zip === preferences.zipCode) return `It is in your ZIP code (${zip}).`;
  if (decision.affectedZipCodes.includes(preferences.zipCode)) {
    return `It is in your ZIP code (${preferences.zipCode}).`;
  }
  const role = decision.affectedRoles.find((entry) => preferences.roles.includes(entry));
  if (role) return `It affects ${role.toLowerCase()}s.`;
  const interest = preferences.interests.find((entry) =>
    decision.topic.toLowerCase().includes(entry.toLowerCase()),
  );
  if (interest) return `It matches your interest in ${interest.toLowerCase()}.`;
  return undefined;
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

export function Brief({ changes }: { changes: DecisionChange[] }) {
  const decisions = useDecisions();
  const { preferences, ready } = usePreferences();

  const changeGroups = useMemo(() => groupChangesByDecision(changes).slice(0, 3), [changes]);

  const near = useMemo(() => {
    const scored = decisions
      .map((decision) => ({
        decision,
        inZip: decision.geography?.zipCode === preferences.zipCode,
        byInterest: preferences.interests.some((interest) =>
          decision.topic.toLowerCase().includes(interest.toLowerCase()),
        ),
      }))
      .filter((entry) => entry.inZip || entry.byInterest)
      .sort((a, b) => Number(b.inZip) - Number(a.inZip));
    return scored.slice(0, 3).map((entry) => entry.decision);
  }, [decisions, preferences]);

  const awaiting = useMemo(
    () =>
      decisions
        .filter((decision) => OPEN_STATUSES.includes(decision.status))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 3),
    [decisions],
  );

  const closed = useMemo(
    () =>
      decisions
        .filter((decision) => CLOSED_STATUSES.includes(decision.status))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 3),
    [decisions],
  );

  const newest = useMemo(
    () => [...decisions].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 3),
    [decisions],
  );

  if (!decisions.length) {
    return (
      <EmptyState
        title="No verified records are published yet"
        body="CivicLens only shows records it can trace to an official source. Once the ingestion job publishes decisions, they will appear here."
      />
    );
  }

  return (
    <div className="space-y-16">
      <Reveal>
        <section aria-labelledby="changed-heading">
          <SectionHeading
            eyebrow="Movement"
            title="Changed this week"
            description="Detected by comparing each ingestion run against the previous one."
            actionHref="/changes"
            actionLabel="See all changes"
          />
          {changeGroups.length ? (
            <Grid>
              {changeGroups.map((group) => (
                <ChangeCard
                  key={group.decisionId}
                  slug={group.slug}
                  title={group.title}
                  organization={group.organization}
                  changes={group.changes}
                />
              ))}
            </Grid>
          ) : (
            <div className="surface flex items-start gap-3 p-5 text-sm text-muted">
              <Info size={17} className="mt-0.5 shrink-0 text-civic" aria-hidden="true" />
              <p>
                No movements have been recorded yet. The change engine reports on its second run — a
                first appearance is a publication, not a change.
              </p>
            </div>
          )}
        </section>
      </Reveal>

      {near.length ? (
        <Reveal>
          <section aria-labelledby="near-heading">
            <SectionHeading
              eyebrow="Where you live"
              title={ready ? `Near ${preferences.zipCode}` : "Near you"}
              description="Records whose location or topic matches your saved preferences."
              actionHref="/my-area"
              actionLabel="Open my area"
            />
            <Grid>
              {near.map((decision) => (
                <DecisionCard key={decision.id} decision={decision} reason={reasonFor(decision, preferences)} />
              ))}
            </Grid>
          </section>
        </Reveal>
      ) : null}

      <Reveal>
        <section aria-labelledby="awaiting-heading">
          <SectionHeading
            eyebrow="Open items"
            title="Awaiting a decision"
            description="Still open for public input, under review, or heading to a vote."
            actionHref="/explore"
            actionLabel="View all open items"
          />
          <Grid>
            {awaiting.map((decision) => (
              <DecisionCard key={decision.id} decision={decision} />
            ))}
          </Grid>
        </section>
      </Reveal>

      <Reveal>
        <section aria-labelledby="new-heading">
          <SectionHeading
            eyebrow="New to the tracker"
            title="Just added"
            description="Records that entered the tracker most recently."
          />
          <Grid>
            {newest.map((decision) => (
              <DecisionCard key={decision.id} decision={decision} />
            ))}
          </Grid>
        </section>
      </Reveal>

      {closed.length ? (
        <Reveal>
          <section aria-labelledby="closed-heading">
            <SectionHeading
              eyebrow="Closed out"
              title="Recently decided"
              description="Items the official record now shows as decided, funded, or complete."
              actionHref="/explore"
              actionLabel="View all decided"
            />
            <Grid>
              {closed.map((decision) => (
                <DecisionCard key={decision.id} decision={decision} />
              ))}
            </Grid>
          </section>
        </Reveal>
      ) : null}

      <Reveal>
        <div className="surface flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-start gap-3">
            <Activity size={18} className="mt-0.5 shrink-0 text-civic" aria-hidden="true" />
            <div>
              <p className="font-extrabold text-ink">Follow what matters and we&apos;ll track it</p>
              <p className="mt-1 text-sm text-muted">
                Follow any record to build your list. Notifications arrive once the movement engine
                has new changes to report.
              </p>
            </div>
          </div>
          <Link href="/following" className="btn btn-secondary">
            Open following
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
