import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getDecisions, getRecentChanges } from "@/server/decisions";
import { PrintButton } from "@/features/brief/print-button";
import {
  decisionPlaceCodes,
  parsePlaceKey,
  placeKindMeta,
  placeLabel,
  type PlaceKind,
} from "@/lib/place";
import { orgNames } from "@/lib/civic";
import { isOpenStatus } from "@/types";
import type { Decision } from "@/types";

export const revalidate = 300;

/**
 * The weekly District Brief — a printable pack for one district.
 *
 * Deliberately an additive sibling of the place page (never a redirect): the
 * place page is for browsing, this is for handing out. Everything here is
 * composed from the same two honest sources the rest of the product reads —
 * the published decision set and the detected-change log — so a printed line
 * on paper can always be traced to a record online. The window is fixed and
 * stated on the page (the last 28 days), because a brief whose period drifts
 * with the server clock is a brief nobody can cite.
 */

const BRIEF_WINDOW_DAYS = 28;

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
    title: `${label} — weekly brief`,
    description: `A printable weekly brief of verified government records for ${label}.`,
  };
}

/** All dates on this page are America/New_York civil days, matching the rest of
 *  the record engine (see lib/deadlines.ts and observatory-story.tsx). */
function charlotteToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function shortDate(date: string | undefined): string {
  if (!date) return "—";
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default async function DistrictBrief({
  params,
}: {
  params: Promise<{ kind: string; code: string }>;
}) {
  const { kind, code } = await params;
  const parsed = parseKindCode(kind, code);
  if (!parsed) notFound();

  const [decisions, changes, ] = await Promise.all([
    getDecisions({ limit: 250 }),
    getRecentChanges({ days: BRIEF_WINDOW_DAYS, limit: 200 }),
  ]);

  const boundaryKind = parsed.kind;
  const label = placeLabel(boundaryKind, parsed.code);
  const meta = placeKindMeta[boundaryKind];

  // A record sits in the district only if the record itself states that place
  // code — identical logic to the place page, so paper and web can't diverge.
  const inside = decisions.filter(
    (decision) => decisionPlaceCodes(decision.geography)[boundaryKind] === parsed.code,
  );

  const open = inside.filter((decision) => isOpenStatus(decision.status));
  const changeIds = new Set(changes.map((change) => change.decisionId));
  const recentlyChanged = inside.filter((decision) => changeIds.has(decision.id));

  const withDates = open
    .filter((decision) => Boolean(decision.deadline?.date))
    .sort((a, b) => (a.deadline?.date ?? "").localeCompare(b.deadline?.date ?? ""));

  const undated = open.filter((decision) => !decision.deadline?.date);
  const today = charlotteToday();
  const windowStart = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(Date.now() - BRIEF_WINDOW_DAYS * 86_400_000));

  const located = decisions.filter(
    (decision) => Object.keys(decisionPlaceCodes(decision.geography)).length > 0,
  ).length;

  return (
    <div className="brief-sheet shell py-8 md:py-12">
      <div className="brief-screen-only flex flex-wrap items-center justify-between gap-3 pb-4">
        <Link
          href={`/places/${boundaryKind}/${parsed.code}`}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-extrabold text-civic transition-colors hover:bg-surface-3"
        >
          ← Back to the district page
        </Link>
        {/* The print affordance is a real browser action, not a PDF library. */}
        <PrintButton />
      </div>

      <header className="brief-head">
        <p className="eyebrow">{meta.name} · District brief</p>
        <h1 className="brief-title">{label}</h1>
        <p className="brief-sub">
          Weekly brief · window {shortDate(windowStart)} – {shortDate(today)} · generated {shortDate(today)}
        </p>
      </header>

      <p className="brief-scope">
        Composed from the {decisions.length.toLocaleString("en-US")}-record verified index ({located.toLocaleString("en-US")}{" "}
        record{located === 1 ? "" : "s"} could be located geographically at all). A decision with no resolved location cannot
        be placed in {label}, so what follows is what the record itself places here — nothing inferred.
      </p>

      <section className="brief-section">
        <h2>What changed in the last {BRIEF_WINDOW_DAYS} days</h2>
        {recentlyChanged.length ? (
          <ul className="brief-list">
            {recentlyChanged.map((decision) => {
              const decisionChanges = changes.filter((change) => change.decisionId === decision.id);
              return (
                <li key={decision.id}>
                  <b>{decision.title}</b> — {orgNames[decision.organization]}
                  <ul>
                    {decisionChanges.slice(0, 3).map((change) => (
                      <li key={change.id}>
                        {shortDate(change.changedAt.slice(0, 10))}: {change.field} updated
                        {change.current ? ` — now “${change.current}”` : ""}
                        {change.sourceUrl ? (
                          <>
                            {" "}(<a className="brief-link" href={change.sourceUrl} target="_blank" rel="noreferrer noopener">official source</a>)
                          </>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="brief-empty">
            No tracked movement in {label} during this window. The change engine reports on its second run — a first
            appearance is a publication, not a change.
          </p>
        )}
      </section>

      <section className="brief-section">
        <h2>On the calendar — published dates</h2>
        {withDates.length ? (
          <table className="brief-table">
            <thead>
              <tr><th scope="col">Date</th><th scope="col">Record</th><th scope="col">Status</th><th scope="col">Source</th></tr>
            </thead>
            <tbody>
              {withDates.map((decision) => {
                const primary = decision.sources.find((s) => s.verificationStatus === "verified" && s.url) ?? decision.sources[0];
                return (
                  <tr key={decision.id}>
                    <td>{shortDate(decision.deadline!.date)}</td>
                    <td><Link href={`/decisions/${decision.slug}`} className="brief-link">{decision.title}</Link></td>
                    <td>{decision.deadline!.label ?? decision.status}</td>
                    <td>
                      {primary && primary.url ? (
                        <a className="brief-link" href={primary.url} target="_blank" rel="noreferrer noopener">{primary.organization}: {primary.title.slice(0, 40)}</a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="brief-empty">
            No open record in {label} currently states a date for its next action. CivicLens does not estimate one — a gap
            in the government's published calendar, reported as a gap.
          </p>
        )}
      </section>

      <section className="brief-section">
        <h2>Still open, no published date</h2>
        {undated.length ? (
          <ul className="brief-list">
            {undated.slice(0, 12).map((decision) => (
              <li key={decision.id}>
                <Link href={`/decisions/${decision.slug}`} className="brief-link">{decision.title}</Link> — {orgNames[decision.organization]} ({decision.status})
              </li>
            ))}
          </ul>
        ) : (
          <p className="brief-empty">Every open record here already appears in the calendar above.</p>
        )}
      </section>

      <footer className="brief-foot">
        <p>
          Produced by CivicLens from the linked official records. Not affiliated with, or endorsed by, the City of
          Charlotte, Mecklenburg County, or Charlotte-Mecklenburg Schools. The linked government record is always
          authoritative; where it is silent, this brief is silent too.
        </p>
      </footer>
    </div>
  );
}
