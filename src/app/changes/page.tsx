import Link from "next/link";
import { Activity } from "lucide-react";
import { getRecentChanges } from "@/server/decisions";
import { ChangeCard } from "@/features/changes/change-card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/section";
import { groupChangesByDecision } from "@/lib/changes";

export const metadata = {
  title: "What changed",
  description: "Every movement CivicLens has detected in the official record, newest first.",
};

function dayLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export default async function ChangesPage() {
  const changes = await getRecentChanges({ limit: 120 });
  const groups = groupChangesByDecision(changes);

  // Group by calendar day so the page reads as a changelog rather than a heap.
  const byDay = new Map<string, typeof groups>();
  for (const group of groups) {
    const key = dayLabel(group.changes[0].changedAt);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(group);
    else byDay.set(key, [group]);
  }

  return (
    <div className="shell py-10 md:py-14">
      <PageHeader
        eyebrow="Movement log"
        title="What changed."
        description="CivicLens compares every ingestion run against the previous one. Everything that moved — a stage change, a new official action, a confirmed next step — is recorded here, with a link back to the source."
        aside={
          <div className="surface hidden max-w-xs p-4 text-sm text-muted md:block">
            <Activity className="mb-3 text-civic" size={18} />
            <b className="block text-ink">A baseline, not a guess</b>
            <span className="mt-1 block leading-5">
              The first run only establishes a baseline. Nothing is reported as a change until the
              record actually moves.
            </span>
          </div>
        }
      />

      <div className="changes-index" aria-label="Movement log summary">
        <div><span>DECISIONS MOVED</span><strong>{groups.length.toLocaleString("en-US")}</strong></div>
        <div><span>OFFICIAL CHANGES</span><strong>{changes.length.toLocaleString("en-US")}</strong></div>
        <div><span>DAYS IN THE LOG</span><strong>{byDay.size.toLocaleString("en-US")}</strong></div>
        <p>Each entry is compared with the prior official record.</p>
      </div>

      <div className="changes-feed">
        {groups.length ? (
          [...byDay.entries()].map(([day, dayGroups]) => (
            <section className="changes-day" key={day}>
              <h2 className="changes-day__heading mb-4 flex items-center gap-3 text-sm font-extrabold uppercase tracking-[0.1em] text-subtle">
                {day}
                <span className="h-px flex-1 bg-line" aria-hidden="true" />
                <span className="text-civic">
                  {dayGroups.length} {dayGroups.length === 1 ? "record" : "records"}
                </span>
              </h2>
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {dayGroups.map((group) => (
                  <ChangeCard
                    key={group.decisionId}
                    slug={group.slug}
                    title={group.title}
                    organization={group.organization}
                    changes={group.changes}
                  />
                ))}
              </div>
            </section>
          ))
        ) : (
          <EmptyState
            icon={<Activity />}
            title="No movements recorded yet"
            body="The change engine reports once it has two snapshots to compare. In the meantime, explore the full set of tracked records."
            action={
              <Link href="/explore" className="btn btn-primary">
                Explore decisions
              </Link>
            }
          />
        )}
      </div>
    </div>
  );
}
