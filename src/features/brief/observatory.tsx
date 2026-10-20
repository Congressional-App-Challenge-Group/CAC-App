"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Activity, ArrowDown, ArrowRight, ArrowUpRight, CalendarClock, Check,
  FileText, Landmark, List, Search, Waypoints,
} from "lucide-react";
import { useDecisions } from "@/components/decisions-provider";
import { orgNames } from "@/lib/civic";
import { agendaKind } from "@/lib/agenda";
import { daysUntil, formatDeadlineDate, upcomingActions } from "@/lib/deadlines";
import { groupChangesByDecision } from "@/lib/changes";
import { isDecidedStatus } from "@/types";
import type { DecisionChange, ObservatoryStory } from "@/types";
import { ObservatoryClosing, ObservatoryStory as Story } from "@/features/brief/observatory-story";

const LegalObservatoryScene = dynamic(
  () => import("@/features/brief/legal-observatory-scene").then((scene) => scene.LegalObservatoryScene),
  { ssr: false },
);

type Period = "upcoming" | "week" | "month" | "past";
type Entry = {
  key: string;
  slug: string;
  title: string;
  organization: string;
  date: string;
  status: string;
  detail: string;
  period: "upcoming" | "past";
  sourceUrl?: string;
};

function shortDate(date: string) {
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function Observatory({ changes, story }: { changes: DecisionChange[]; story: ObservatoryStory | null }) {
  const decisions = useDecisions();
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<Period>("upcoming");
  const [listView, setListView] = useState(false);

  const searchResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return decisions
      .filter((item) => `${item.title} ${item.summary} ${item.topic} ${orgNames[item.organization]} ${item.sources.map((source) => source.title).join(" ")}`.toLowerCase().includes(needle))
      .slice(0, 4);
  }, [decisions, query]);

  const scheduled = useMemo(
    () => upcomingActions(decisions, { limit: 100 }).filter((item) => agendaKind(item.deadline.officialStatus) !== "informational"),
    [decisions],
  );
  const recentDecisions = useMemo(
    () => decisions.filter((item) => isDecidedStatus(item.status)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3),
    [decisions],
  );
  const recentChanges = useMemo(() => groupChangesByDecision(changes).slice(0, 3), [changes]);

  const entries = useMemo<Entry[]>(() => {
    const future: Entry[] = scheduled.slice(0, 8).map(({ decision, deadline, days }) => ({
      key: `deadline-${decision.id}`,
      slug: decision.slug,
      title: decision.title,
      organization: orgNames[decision.organization],
      date: deadline.date ?? "",
      status: days === 0 ? "Today" : days === 1 ? "Tomorrow" : decision.status,
      detail: deadline.label ?? deadline.officialStatus ?? decision.nextStep ?? "Published next action",
      period: "upcoming",
      sourceUrl: deadline.sourceUrl,
    }));
    const seen = new Set<string>();
    const past: Entry[] = [...changes]
      .sort((a, b) => b.changedAt.localeCompare(a.changedAt))
      .filter((change) => change.slug && !seen.has(change.decisionId) && Boolean(seen.add(change.decisionId)))
      .slice(0, 8)
      .map((change) => ({
        key: `change-${change.id}`,
        slug: change.slug,
        title: change.title,
        organization: orgNames[change.organization],
        date: change.changedAt.slice(0, 10),
        status: "Official record updated",
        detail: change.current ? `${change.field}: ${change.current}` : `The official ${change.field} changed.`,
        period: "past",
        sourceUrl: change.sourceUrl,
      }));
    return [...future, ...past];
  }, [scheduled, changes]);

  const visibleEntries = useMemo(() => entries.filter((entry) => {
    if (period === "past") return entry.period === "past";
    if (entry.period !== "upcoming") return false;
    const days = daysUntil(entry.date);
    if (period === "week") return days <= 7;
    if (period === "month") {
      const date = new Date(`${entry.date}T12:00:00Z`);
      const now = new Date();
      return date.getUTCFullYear() === now.getFullYear() && date.getUTCMonth() === now.getMonth();
    }
    return true;
  }), [entries, period]);

  const topics = useMemo(() => {
    const counts = new Map<string, number>();
    decisions.forEach((item) => counts.set(item.topic, (counts.get(item.topic) ?? 0) + 1));
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [decisions]);

  return (
    <>
      <section className="observatory-hero" aria-labelledby="observatory-title">
        <div className="observatory-architecture" aria-hidden="true"><i /><i /><i /><i /><span /></div>
        <div className="observatory-stage" aria-hidden="true">
          <div className="observatory-fallback"><span /><i /><i /><i /><b /></div>
          <LegalObservatoryScene />
        </div>
        <div className="observatory-hero__content">
          <p className="observatory-kicker"><span />Law. Decisions. What comes next.</p>
          <h1 id="observatory-title">See what <em>the law</em><br className="observatory-desktop-break" /> is changing.</h1>
          <p className="observatory-hero__summary">Legislation, public decisions, and critical deadlines — explained in one clear place.</p>
          <div className="observatory-search-wrap">
            <form action="/explore" method="get" role="search" className="observatory-search" onSubmit={(event) => {
              event.preventDefault();
              const parameters = new URLSearchParams();
              if (query.trim()) parameters.set("q", query.trim());
              window.location.assign(`/explore${parameters.size ? `?${parameters}` : ""}`);
            }}>
              <Search size={20} aria-hidden="true" />
              <label className="sr-only" htmlFor="observatory-search-input">Search legislation, decisions, agencies, or deadlines</label>
              <input
                id="observatory-search-input"
                name="q"
                type="search"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="observatory-suggestions"
                aria-expanded={Boolean(query.trim())}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search legislation, decisions, agencies, or deadlines..."
              />
              <button type="submit" aria-label="Search public records"><ArrowRight size={19} /></button>
            </form>
            {query.trim() ? (
              <div className="observatory-suggestions" id="observatory-suggestions" role="listbox" aria-label="Matching tracked records">
                {searchResults.length ? searchResults.map((item) => (
                  <Link key={item.id} role="option" aria-selected="false" href={`/decisions/${item.slug}`}>
                    <span className="suggestion-kind"><FileText size={14} /> {item.sources[0]?.title.toLowerCase().includes("agenda") ? "Government agenda" : "Tracked decision"}</span>
                    <strong>{item.title}</strong>
                    <small>{orgNames[item.organization]} · {item.status}</small>
                  </Link>
                )) : <p role="status">No matching tracked records. Press Enter to search the full index.</p>}
              </div>
            ) : null}
          </div>
          <div className="observatory-actions">
            <Link className="observatory-button observatory-button--primary" href="#record-in-motion">Follow a decision <ArrowRight size={17} /></Link>
            <Link className="observatory-button observatory-button--secondary" href="/explore">Browse public records</Link>
          </div>
          <p className="observatory-scope"><span>{decisions.length.toLocaleString("en-US")}</span> tracked records · Charlotte, Mecklenburg, Durham &amp; CMS</p>
        </div>
        <nav className="observatory-labels" aria-label="Explore the observatory">
          <Link className="observatory-label observatory-label--records" href="/explore"><FileText size={14} /> Public records</Link>
          <Link className="observatory-label observatory-label--decisions" href="/changes"><Landmark size={14} /> Decisions</Link>
          <Link className="observatory-label observatory-label--deadlines" href="/deadlines"><CalendarClock size={14} /> Deadlines</Link>
          <Link className="observatory-label observatory-label--impact" href="/my-area"><Waypoints size={14} /> Public impact</Link>
        </nav>
        <a className="observatory-scroll" href="#record-in-motion"><span>Scroll to the public record</span><ArrowDown size={15} /></a>
      </section>

      <Story story={story} />

      <section className="observatory-section observatory-pulse" id="civic-pulse" aria-labelledby="pulse-title">
        <header className="observatory-section-heading">
          <div><p className="observatory-kicker"><span />The record, in motion</p><h2 id="pulse-title">The civic pulse</h2></div>
          <p>See what&apos;s approaching, what&apos;s changed, and what matters now.</p>
        </header>
        <div className="pulse-grid">
          <article className="pulse-panel pulse-panel--deadlines">
            <header><span className="panel-icon"><CalendarClock size={18} /></span><div><p>ON THE PUBLIC CALENDAR</p><h3>Upcoming deadlines</h3></div><Link href="/deadlines" aria-label="All upcoming deadlines"><ArrowUpRight size={18} /></Link></header>
            {scheduled.length ? <ul className="pulse-list">{scheduled.slice(0, 3).map(({ decision, deadline, countdown }) => (
              <li key={decision.id}><span className="pulse-date">{deadline.date ? shortDate(deadline.date) : countdown}</span><Link href={`/decisions/${decision.slug}`}><strong>{decision.title}</strong><small>{orgNames[decision.organization]} · {deadline.label ?? decision.status}</small></Link></li>
            ))}</ul> : <p className="pulse-empty">No upcoming action has a date in the records. CivicLens doesn&apos;t estimate one.</p>}
            <Link className="panel-more" href="/deadlines">See all published dates <ArrowRight size={15} /></Link>
          </article>
          <article className="pulse-panel pulse-panel--decisions">
            <header><span className="panel-icon"><Landmark size={18} /></span><div><p>RECORDED OUTCOMES</p><h3>Recent decisions</h3></div><Link href="/explore?quick=decided" aria-label="Explore decided records"><ArrowUpRight size={18} /></Link></header>
            {recentDecisions.length ? <ul className="pulse-list">{recentDecisions.map((decision) => (
              <li key={decision.id}><span className="pulse-status pulse-status--verified"><Check size={13} />{decision.status}</span><Link href={`/decisions/${decision.slug}`}><strong>{decision.title}</strong><small>{orgNames[decision.organization]} · {shortDate(decision.lastActivityAt ?? decision.updatedAt)}</small></Link></li>
            ))}</ul> : <p className="pulse-empty">No completed outcomes are currently listed. Browse the records still in motion.</p>}
            <Link className="panel-more" href="/explore">Browse all decisions <ArrowRight size={15} /></Link>
          </article>
          <article className="pulse-panel pulse-panel--changes">
            <header><span className="panel-icon"><Activity size={18} /></span><div><p>VERIFIED MOVEMENT</p><h3>Recently changed</h3></div><Link href="/changes" aria-label="Full change log"><ArrowUpRight size={18} /></Link></header>
            {recentChanges.length ? <ul className="pulse-list">{recentChanges.map((group) => (
              <li key={group.decisionId}><span className="pulse-date">{shortDate(group.changes[0].changedAt)}</span><Link href={`/decisions/${group.slug}`}><strong>{group.title}</strong><small>{orgNames[group.organization]} · {group.changes.length} recorded {group.changes.length === 1 ? "change" : "changes"}</small></Link></li>
            ))}</ul> : <p className="pulse-empty">No changes have been reported yet. A first appearance establishes a baseline, not a change.</p>}
            <Link className="panel-more" href="/changes">Read the movement log <ArrowRight size={15} /></Link>
          </article>
        </div>
      </section>

      <section className="observatory-section observatory-timeline" id="legal-timeline" aria-labelledby="timeline-title">
        <header className="observatory-section-heading">
          <div><p className="observatory-kicker"><span />A record, not a prediction</p><h2 id="timeline-title">The timeline of change</h2></div>
          <p>Follow verified dates and recorded updates. Every point leads back to its record.</p>
        </header>
        <div className="timeline-console">
          <div className="timeline-console__top">
            <p><span className="timeline-live-dot" />CIVIC RECORD <span className="timeline-count">{visibleEntries.length} events shown</span></p>
            <div className="timeline-controls" role="group" aria-label="Filter timeline">
              {([ ["upcoming", "Upcoming"], ["week", "This week"], ["month", "This month"], ["past", "Past events"] ] as const).map(([key, label], index) => (
                <button type="button" key={key} aria-pressed={period === key} onClick={() => setPeriod(key)} onKeyDown={(event) => {
                  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                  event.preventDefault();
                  const next = (index + (event.key === "ArrowRight" ? 1 : -1) + 4) % 4;
                  setPeriod((["upcoming", "week", "month", "past"] as const)[next]);
                  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button:not(.timeline-view-toggle)")[next]?.focus();
                }}>{label}</button>
              ))}
              <button className="timeline-view-toggle" type="button" aria-pressed={listView} onClick={() => setListView((value) => !value)} aria-label={listView ? "Show timeline view" : "Show chronological list view"}>{listView ? <Waypoints size={16} /> : <List size={16} />}<span>{listView ? "Timeline" : "List"}</span></button>
            </div>
          </div>
          {visibleEntries.length ? (
            <ol className={`timeline-events${listView ? " timeline-events--list" : ""}`}>
              {visibleEntries.slice(0, 8).map((entry) => (
                <li key={entry.key} className={`timeline-event timeline-event--${entry.period}`}>
                  <span className="timeline-marker" aria-hidden="true"><i /></span>
                  <time dateTime={entry.date}>{shortDate(entry.date)}</time>
                  <Link href={`/decisions/${entry.slug}`}><strong>{entry.title}</strong><span>{entry.organization}</span></Link>
                  <p><b>{entry.status}</b><span>{entry.detail}</span></p>
                  {entry.sourceUrl ? <a className="timeline-source" href={entry.sourceUrl} target="_blank" rel="noreferrer">Official source <ArrowUpRight size={13} /></a> : <Link className="timeline-source" href={`/decisions/${entry.slug}`}>Open record <ArrowUpRight size={13} /></Link>}
                </li>
              ))}
            </ol>
          ) : <p className="timeline-empty">No records with a published date match this view. Choose another period or browse the full record.</p>}
          <p className="timeline-note">Dates come from published records. A blank date stays blank; no milestone is inferred.</p>
        </div>
      </section>

      <section className="observatory-section observatory-topics" aria-labelledby="topics-title">
        <header className="observatory-section-heading">
          <div><p className="observatory-kicker"><span />Find your way in</p><h2 id="topics-title">Issues in the public record</h2></div>
          <Link className="observatory-text-link" href="/explore">Explore all records <ArrowRight size={16} /></Link>
        </header>
        <div className="topic-grid">{topics.map(([topic, count], index) => (
          <Link key={topic} href={`/explore?topic=${encodeURIComponent(topic)}`} className="topic-link">
            <span className="topic-number">{String(index + 1).padStart(2, "0")}</span><span><strong>{topic}</strong><small>{count} tracked {count === 1 ? "record" : "records"}</small></span><ArrowUpRight size={17} />
          </Link>
        ))}</div>
      </section>

      <ObservatoryClosing story={story} />
    </>
  );
}
