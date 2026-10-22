import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  Info,
  MapPin,
  PenLine,
  Users,
  Wallet,
} from "lucide-react";
import { getDecision, resolveSlugAlias } from "@/server/decisions";
import { orgNames } from "@/lib/civic";
import { hasCoordinates } from "@/lib/geography";
import { Timeline } from "@/features/timeline/timeline";
import { DecisionCard } from "@/features/decisions/decision-card";
import { ParticipationPanel } from "@/features/decisions/participation";
import { DistrictPanel } from "@/features/place/districts";
import { AskBox } from "@/features/assistant/ask-box";
import { ProvenancePanel } from "@/components/ui/provenance";
import { MiniMap } from "@/components/ui/map";
import { DeadlinePanel } from "@/components/ui/deadline";
import { formatDeadlineDate, nextDeadline } from "@/lib/deadlines";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Note, Surface } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { DocumentSummaryButton } from "@/features/ai/document-summary-button";
import { DecisionComparisonButton } from "@/features/ai/decision-comparison-button";
import { ImpactAnalysisButton } from "@/features/ai/impact-analysis-button";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const decision = await getDecision(slug);
  if (!decision) return { title: "Decision not found" };
  return {
    title: decision.title,
    description: decision.summary.slice(0, 300),
  };
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function Section({
  n,
  title,
  description,
  children,
}: {
  n: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 border-t border-line pt-8">
      <div className="mb-5 flex items-start gap-3">
        <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface-3 text-[10px] font-black text-civic-strong">
          {n}
        </span>
        <div>
          <h2 className="display-3 text-ink">{title}</h2>
          {description ? <p className="mt-1.5 text-sm text-muted">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function FactTile({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <Surface className="p-4">
      <span className="text-civic">{icon}</span>
      <p className="mt-3 text-[10px] font-extrabold uppercase tracking-[0.08em] text-subtle">{title}</p>
      <p className="mt-2 text-sm font-bold leading-5 text-ink">{text}</p>
    </Surface>
  );
}

export default async function DecisionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const decision = await getDecision(slug);
  if (!decision) {
    // A slug retired by the matter collapse redirects rather than 404ing, so a
    // link shared before the record set was corrected still lands somewhere true.
    const alias = await resolveSlugAlias(slug);
    if (alias && alias !== slug) permanentRedirect(`/decisions/${alias}`);
    notFound();
  }

  const geography = decision.geography;
  const located = hasCoordinates(geography);
  const hasBeforeAfter = Boolean(decision.beforeText || decision.afterText);

  // The deadline engine prefers the government's own register over inferred dates,
  // so the "next date" tile and the countdown always agree.
  const now = new Date();
  const deadline = nextDeadline(decision, now);
  const nextDate = decision.importantDates[0];
  const nextDateText = deadline
    ? `${formatDeadlineDate(deadline.date!)}${
        deadline.origin === "official-tracker" ? " · from the government's register" : ""
      }`
    : nextDate
      ? `${nextDate.date} · ${nextDate.label}`
      : "None confirmed";

  let sectionNumber = 1;
  const nextNumber = () => String(sectionNumber++).padStart(2, "0");

  return (
    <div className="shell py-8 md:py-12">
      <Link
        href="/explore"
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-extrabold text-civic transition-colors hover:bg-surface-3"
      >
        <ArrowLeft size={16} />
        All decisions
      </Link>

      <div className="mt-7 grid gap-10 lg:grid-cols-[minmax(0,1fr)_350px]">
        <article>
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow">
              {orgNames[decision.organization]} · {decision.topic}
            </span>
            <StatusBadge status={decision.status} />
            {/*
              "Plain language" and not "Editor-reviewed": the review is the
              approval gate, which is automated and can refuse. Claiming a person
              had read it would be one more thing the interface asserts that it
              cannot support.
            */}
            {decision.plainLanguageApproved ? (
              <Badge tone="accent">
                <PenLine size={11} />
                Plain language
              </Badge>
            ) : null}
          </div>

          <h1 className="mt-4 max-w-4xl display-2 text-ink md:text-5xl">{decision.title}</h1>

          {decision.requester ? (
            <p className="mt-3 text-sm text-muted">
              Requested by <b className="text-ink">{decision.requester}</b>
            </p>
          ) : null}

          <p className="mt-6 max-w-3xl reading md:text-lg">{decision.summary}</p>

          <div className="mt-5 flex flex-wrap gap-2">
            <DocumentSummaryButton
              decisionId={decision.id}
              sourceId={decision.sources[0]?.id || ""}
              sourceTitle={decision.sources[0]?.title || "Decision summary"}
              variant="primary"
            />
            <DecisionComparisonButton
              decisionId={decision.id}
              variant="secondary"
            />
            <ImpactAnalysisButton
              decisionId={decision.id}
              variant="secondary"
            />
          </div>

          <div className="mt-7 max-w-2xl">
            <DeadlinePanel decision={decision} now={now} />
          </div>

          <div className="mt-6 rounded-[var(--radius-lg)] border border-line bg-surface-2 p-5">
            <p className="eyebrow mb-2">Quick question about this decision?</p>
            <AskBox decision={decision} compact />
          </div>

          {!decision.plainLanguageApproved ? (
            <Note tone="neutral" className="mt-5 flex items-start gap-2">
              <Info size={16} className="mt-0.5 shrink-0 text-civic" aria-hidden="true" />
              <span className="text-muted">
                This is the wording of the official record. A plain-language rewrite appears here only
                once it has passed a review that checks every figure, date and stage in it against the
                source. This one has not, so you are reading the government&apos;s own words.
              </span>
            </Note>
          ) : null}

          <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FactTile
              icon={<Users size={18} />}
              title="Who may be affected"
              text={decision.affectedRoles.join(", ") || "Not confirmed"}
            />
            <FactTile
              icon={<MapPin size={18} />}
              title="Where"
              text={
                geography?.address ??
                geography?.neighborhood ??
                (geography?.zipCode ? `ZIP ${geography.zipCode}` : "Not confirmed")
              }
            />
            <FactTile
              icon={<CalendarDays size={18} />}
              title="Next important date"
              text={nextDateText}
            />
            <FactTile
              icon={<Wallet size={18} />}
              title="Public money"
              text={
                decision.money?.amountUsd
                  ? `${formatMoney(decision.money.amountUsd)}${
                      decision.money.fiscalYear ? ` · ${decision.money.fiscalYear}` : ""
                    }`
                  : "No figure stated in the record"
              }
            />
          </div>

          {located && geography ? (
            <div className="mt-6">
              <MiniMap
                center={{ latitude: geography.latitude!, longitude: geography.longitude! }}
                points={[
                  {
                    id: decision.id,
                    latitude: geography.latitude!,
                    longitude: geography.longitude!,
                    label: geography.address ?? decision.title,
                    tone: "accent",
                    href: `/decisions/${decision.slug}`,
                  },
                ]}
                activeId={decision.id}
                height={260}
                zoom={15}
              />
              <p className="mt-2 text-xs text-subtle">
                {geography.address ? `${geography.address} · ` : ""}
                Location matched against an official dataset. Confirm with the linked record.
              </p>
            </div>
          ) : null}

          <Section
            n={nextNumber()}
            title="Why it matters"
            description="Written for residents, grounded in the record above."
          >
            <p>{decision.whyItMatters}</p>
          </Section>

          <Section n={nextNumber()} title="Latest official update">
            <div className="rounded-[var(--radius-lg)] border border-line bg-surface-2 p-5">
              <p className="text-ink-soft">{decision.latestUpdate}</p>
              <p className="mt-4 border-t border-line pt-4 text-ink-soft">
                <b className="text-ink">Next expected step:</b>{" "}
                {decision.nextStep || "No next step confirmed in the official record."}
              </p>
            </div>
          </Section>

          {hasBeforeAfter ? (
            <Section n={nextNumber()} title="Before and after">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[var(--radius-lg)] bg-surface-3 p-5">
                  <p className="eyebrow">Before</p>
                  <p className="mt-3 text-ink-soft">{decision.beforeText || "Not confirmed"}</p>
                </div>
                <div className="rounded-[var(--radius-lg)] bg-civic/8 p-5">
                  <p className="eyebrow">After</p>
                  <p className="mt-3 text-ink-soft">{decision.afterText || "Not confirmed"}</p>
                </div>
              </div>
            </Section>
          ) : null}

          <Section
            n={nextNumber()}
            title="Decision timeline"
            description={
              decision.timeline.length > 1
                ? "Every action recorded in the official record, newest first."
                : "The record currently shows a single action for this item."
            }
          >
            {decision.timeline.length ? (
              <Timeline events={decision.timeline} />
            ) : (
              <p className="text-muted">No verified timeline events have been recorded yet.</p>
            )}
          </Section>

          <Section n={nextNumber()} title="Official sources">
            {decision.sources.length ? (
              <ul className="grid gap-3">
                {decision.sources.map((source) => (
                  <li className="card group p-5" key={source.id}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex items-center justify-between gap-4 font-extrabold text-civic hover:text-civic-strong"
                    >
                      <span className="underline decoration-civic/25 underline-offset-4">
                        {source.title}
                      </span>
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-3 transition-transform group-hover:-translate-y-0.5">
                        <ExternalLink size={16} />
                      </span>
                    </a>
                    <p className="mt-2 text-xs text-subtle">
                      {source.organization}
                      {source.pageReference ? ` · ${source.pageReference}` : ""} ·{" "}
                      {source.verificationStatus}
                    </p>
                    <DocumentSummaryButton
                      decisionId={decision.id}
                      sourceId={source.id}
                      sourceTitle={source.title}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">
                No official source is attached to this record yet, so it should be treated as
                unconfirmed.
              </p>
            )}
          </Section>

          <div className="mt-12" id="ask">
            <AskBox decision={decision} />
          </div>
        </article>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <DecisionCard decision={decision} reason="You opened this record" />

          <div className="grid grid-cols-2 gap-3">
            <Stat value={decision.timeline.length} label="Recorded actions" />
            <Stat value={decision.sources.length} label="Official sources" />
          </div>

          <ParticipationPanel decision={decision} />
          <DistrictPanel decision={decision} />
          <ProvenancePanel
            sources={decision.sources}
            lastCheckedAt={decision.lastCheckedAt}
            geography={geography}
            requester={decision.requester}
            officialStatus={decision.deadline?.officialStatus}
          />
        </aside>
      </div>
    </div>
  );
}
