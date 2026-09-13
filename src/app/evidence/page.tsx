import type { Metadata } from "next";
import Link from "next/link";
import { Info, MinusCircle, ShieldAlert } from "lucide-react";
import { getDecisions } from "@/server/decisions";
import { buildDisclosureReport, gapPercent } from "@/lib/disclosure";
import { PageHeader } from "@/components/ui/section";
import { Stat, StatRow } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/empty-state";
import { Note } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "The disclosure gap",
  description:
    "How many local government records CivicLens indexed state no location, no affected group, no figure and no date — counted exactly across the records we hold.",
};

/** How the meter reads: green when the gap is small, red when it is most of the set. */
function gapTone(share: number): string {
  if (share >= 0.75) return "bg-danger";
  if (share >= 0.4) return "bg-warning";
  if (share >= 0.15) return "bg-civic";
  return "bg-success";
}

export default async function EvidencePage() {
  const decisions = await getDecisions();
  const report = buildDisclosureReport(decisions, { now: new Date() });

  if (!report.total) {
    return (
      <div className="shell py-10 md:py-14">
        <PageHeader eyebrow="The gap" title="What the record doesn't say" />
        <div className="mt-10">
          <EmptyState
            title="No records to measure yet"
            body="This page counts what the official records omit. It needs an indexed set to measure, so it will populate once the pipeline has published decisions."
          />
        </div>
      </div>
    );
  }

  const worst = [...report.gaps].sort((a, b) => b.share - a.share)[0];

  return (
    <div className="shell py-10 md:py-14">
      <PageHeader
        eyebrow="The gap"
        title="What the record doesn't say"
        description="Most civic tools report what a government published. This measures the opposite: how often the published record stays silent about the things a resident needs in order to act."
      />

      {/* The scope sentence is the most important line on the page. It is generated
          from the data, so it can never overstate what was counted. */}
      <Note tone="accent" className="mt-9 p-5">
        <p className="text-sm font-extrabold uppercase tracking-[0.08em] text-civic-strong">
          Scope of this measurement
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">{report.scopeStatement}</p>
      </Note>

      <div className="mt-8">
        <StatRow className="sm:grid-cols-3 lg:grid-cols-5">
          <Stat value={report.total} label="Records indexed" />
          <Stat value={report.located} label="With a confirmed location" />
          <Stat value={report.scheduled} label="With a stated action date" />
          <Stat value={report.open} label="Still open" />
          <Stat value={report.decided} label="Resolved" />
        </StatRow>
      </div>

      {/* Lead finding, stated as narrowly as the data supports. */}
      <section className="mt-12" aria-labelledby="lead">
        <h2 id="lead" className="display-3 text-ink">
          The headline omission
        </h2>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-ink-soft">
          <b className="text-ink">
            {gapPercent(worst)}% of the records measured here disclose {worst.missingLabel.toLowerCase()}
          </b>{" "}
          — {worst.missing} of {worst.total}. {worst.consequence}
        </p>
      </section>

      <section className="mt-12" aria-labelledby="meters">
        <h2 id="meters" className="display-3 text-ink">
          Every gap, with its own denominator
        </h2>
        <p className="mt-3 max-w-3xl text-sm text-muted">
          Each measure is taken against the records it can honestly apply to. Money is measured only
          against records that move public money; scheduling only against records still open. Mixing
          them into one number would make all of them meaningless.
        </p>

        <ul className="mt-7 space-y-4">
          {report.gaps.map((gap) => {
            const percent = gapPercent(gap);
            return (
              <li key={gap.key} className="card p-5 md:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                  <div className="min-w-0">
                    <h3 className="text-base font-black tracking-[-0.02em] text-ink">
                      {gap.missingLabel}
                    </h3>
                    <p className="mt-1 text-sm text-muted">{gap.question}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black tracking-[-0.045em] text-ink">{percent}%</p>
                    <p className="text-xs font-bold text-subtle">
                      {gap.missing} of {gap.total}
                    </p>
                  </div>
                </div>

                <div
                  className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-surface-3"
                  role="img"
                  aria-label={`${percent} percent of ${gap.total} records: ${gap.missingLabel}`}
                >
                  <div
                    className={cn("h-full rounded-full transition-[width]", gapTone(gap.share))}
                    style={{ width: `${Math.max(percent, gap.missing > 0 ? 2 : 0)}%` }}
                  />
                </div>

                <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-ink-soft">
                  <MinusCircle size={15} className="mt-1 shrink-0 text-subtle" aria-hidden="true" />
                  <span>{gap.consequence}</span>
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="stuck">
        <h2 id="stuck" className="display-3 text-ink">
          Items that never resolved
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="card p-5">
            <p className="text-4xl font-black tracking-[-0.045em] text-ink">{report.stuck.count}</p>
            <p className="mt-2 text-sm font-extrabold text-ink">Open with no recorded outcome</p>
            <p className="mt-2 text-xs leading-5 text-muted">
              Still at “Under review” more than {report.stuck.olderThanDays} days after the record was
              published — {Math.round(report.stuck.shareOfOpen * 100)}% of everything still open.
            </p>
          </div>
          <div className="card p-5">
            <p className="text-4xl font-black tracking-[-0.045em] text-ink">
              {report.singleEvent.count}
            </p>
            <p className="mt-2 text-sm font-extrabold text-ink">Never recorded a second action</p>
            <p className="mt-2 text-xs leading-5 text-muted">
              {Math.round(report.singleEvent.share * 100)}% of the set shows a single timeline event,
              so there is nothing to report as movement and nothing to follow.
            </p>
          </div>
          <div className="card p-5">
            <p className="text-4xl font-black tracking-[-0.045em] text-ink">
              {report.total - report.scheduled}
            </p>
            <p className="mt-2 text-sm font-extrabold text-ink">No stated date for a next action</p>
            <p className="mt-2 text-xs leading-5 text-muted">
              Without a date on the record, there is no countdown a resident can act on — that is the
              gap the deadline view measures.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="coverage">
        <h2 id="coverage" className="display-3 text-ink">
          Where these records come from
        </h2>
        <div className="mt-5 flex flex-wrap gap-3">
          {report.organizations.map((organization) => (
            <div key={organization.key} className="card p-4">
              <p className="text-2xl font-black tracking-[-0.04em] text-ink">{organization.total}</p>
              <p className="mt-1 text-xs font-extrabold text-subtle">{organization.name}</p>
            </div>
          ))}
        </div>
        {report.firstRecordDate && report.lastRecordDate ? (
          <p className="mt-4 text-sm text-muted">
            Records span {report.firstRecordDate} to {report.lastRecordDate}.
          </p>
        ) : null}
      </section>

      <section className="mt-12 border-t border-line pt-8" aria-labelledby="method">
        <div className="flex items-start gap-3">
          <ShieldAlert size={19} className="mt-0.5 shrink-0 text-civic" aria-hidden="true" />
          <div className="max-w-3xl">
            <h2 id="method" className="display-3 text-ink">
              How this is counted, and what it does not claim
            </h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-ink-soft">
              <li>
                <b className="text-ink">Every figure is generated from the records CivicLens holds.</b>{" "}
                The scope line above names the exact count and sources. Nothing here describes local
                government as a whole, and it should not be read that way.
              </li>
              <li>
                <b className="text-ink">A gap is not an accusation.</b> Plenty of these items
                genuinely have no location or no cost — a proclamation, a board appointment, a
                procedural motion. This measures what the record states, not what anyone did wrong.
              </li>
              <li>
                <b className="text-ink">Nothing here is imputed.</b> CivicLens only fills a field from
                an official dataset, and only reports a date the record itself publishes. Where
                nothing was stated, these numbers stay missing rather than estimated.
              </li>
              <li>
                <b className="text-ink">Figures move as the record moves.</b> The set refreshes from
                the governments&apos; own feeds, so these percentages change. Regenerated every ten
                minutes from the current dataset.
              </li>
            </ul>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Badge tone="neutral">Generated {new Date(report.generatedAt).toUTCString()}</Badge>
              <Link href="/changes" className="text-xs font-extrabold text-civic hover:text-civic-strong">
                What has moved recently
              </Link>
              <Link href="/deadlines" className="text-xs font-extrabold text-civic hover:text-civic-strong">
                What is about to be decided
              </Link>
            </div>
          </div>
        </div>
      </section>

      <p className="mt-10 flex items-start gap-2 text-xs leading-5 text-subtle">
        <Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
        This page intentionally reports only what the indexed records contain. If you spot a figure
        that misstates a record, that is a correctness bug and worth fixing rather than explaining.
      </p>
    </div>
  );
}
