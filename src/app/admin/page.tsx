import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { getDecisions, getPendingDrafts, getRecentChanges } from "@/server/decisions";
import { getIngestionHealth } from "@/server/ops";
import { needsPlainLanguage } from "@/lib/enrichment";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Stat } from "@/components/ui/stat";

export const dynamic = "force-dynamic";

export const metadata = { title: "Editorial overview" };

export default async function AdminPage() {
  const [decisions, drafts, changes, health] = await Promise.all([
    getDecisions({ includeArchived: true, withRelations: true, limit: 500 }),
    getPendingDrafts(200),
    getRecentChanges({ days: 7, limit: 200 }),
    getIngestionHealth(),
  ]);

  const active = decisions.filter((decision) => !decision.archivedAt);
  const missingPlainLanguage = active.filter(needsPlainLanguage).length;
  const located = active.filter((decision) => decision.geography?.method && decision.geography.method !== "none").length;

  return (
    <div>
      <h1 className="display-2 text-ink">Editorial overview</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
        Where the tracked record stands, what is waiting on an editor, and whether the ingestion job
        is healthy.
      </p>

      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat value={active.length} label="Active records" />
        <Stat
          value={drafts.length}
          label="Drafts awaiting review"
          hint={drafts.length ? "Nothing publishes without approval" : "Queue is clear"}
        />
        <Stat
          value={missingPlainLanguage}
          label="Still showing raw record text"
          hint={missingPlainLanguage ? "Run the plain-language job" : "All rewritten"}
        />
        <Stat value={changes.length} label="Changes this week" />
      </div>

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Editorial</p>
            <h2 className="mt-1 display-3 text-ink">Plain-language queue</h2>
          </div>
          <Link href="/admin/drafts" className="btn btn-primary">
            Review {drafts.length} draft{drafts.length === 1 ? "" : "s"}
          </Link>
        </div>
        <div className="card p-5 text-sm text-muted">
          <p className="leading-6">
            Generated summaries are written from the record&apos;s own wording and stay invisible to the
            public until an editor approves them. {located} of {active.length} active records have a
            confirmed location.
          </p>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4">
          <p className="eyebrow">Pipeline</p>
          <h2 className="mt-1 display-3 text-ink">Ingestion health</h2>
        </div>

        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface-2 text-[10px] uppercase tracking-[0.1em] text-subtle">
              <tr>
                <th className="px-4 py-3 font-extrabold">Source</th>
                <th className="px-4 py-3 font-extrabold">State</th>
                <th className="px-4 py-3 font-extrabold">Documents</th>
                <th className="px-4 py-3 font-extrabold">Changed</th>
                <th className="px-4 py-3 font-extrabold">Candidates</th>
                <th className="px-4 py-3 font-extrabold">Last finished</th>
              </tr>
            </thead>
            <tbody>
              {health.map((source) => (
                <tr key={source.key} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-bold text-ink">{source.name}</td>
                  <td className="px-4 py-3">
                    {source.status === "failed" ? (
                      <Badge tone="danger">
                        <AlertTriangle size={11} />
                        Failed
                      </Badge>
                    ) : source.stale ? (
                      <Badge tone="warning">
                        <Clock size={11} />
                        Stale
                      </Badge>
                    ) : (
                      <Badge tone="success">
                        <CheckCircle2 size={11} />
                        Healthy
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{source.documentsFound}</td>
                  <td className="px-4 py-3 text-muted">{source.documentsChanged}</td>
                  <td className="px-4 py-3 text-muted">{source.candidatesFound}</td>
                  <td className="px-4 py-3 text-muted">
                    {source.finishedAt
                      ? new Date(source.finishedAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-subtle">
          A source is treated as stale after 36 hours without a completed run. Failures are surfaced here
          instead of being lost to logs.
        </p>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Record</p>
            <h2 className="mt-1 display-3 text-ink">Most recently updated</h2>
          </div>
          <Link href="/admin/decisions" className="btn btn-secondary">
            All decisions
          </Link>
        </div>
        <ul className="card divide-y divide-line">
          {active
            .slice()
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .slice(0, 8)
            .map((decision) => (
              <li key={decision.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <Link
                    href={`/decisions/${decision.slug}`}
                    className="block truncate font-bold text-ink hover:text-civic"
                  >
                    {decision.title}
                  </Link>
                  <p className="mt-1 text-xs text-subtle">
                    {decision.sources.length} sources · {decision.timeline.length} timeline events
                    {needsPlainLanguage(decision) ? " · needs plain language" : ""}
                  </p>
                </div>
                <StatusBadge status={decision.status} />
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
