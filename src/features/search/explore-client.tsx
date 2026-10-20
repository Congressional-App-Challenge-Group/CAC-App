"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowUpRight, Filter, Landmark, Search, SlidersHorizontal, X } from "lucide-react";
import { useDecisions } from "@/components/decisions-provider";
import { DecisionCard } from "@/features/decisions/decision-card";
import { usePreferences } from "@/features/preferences/preferences";
import { orgNames } from "@/lib/civic";
import { isDecidedStatus, statuses } from "@/types";

const quickFilters = [
  { value: "", label: "Everything" },
  { value: "awaiting", label: "Still in motion" },
  { value: "recent", label: "Updated recently" },
  { value: "area", label: "In my ZIP" },
  { value: "approved", label: "Approved" },
  { value: "decided", label: "Recorded outcomes" },
];

export function ExploreClient({
  initialQuery = "",
  initialTopic = "",
  initialQuick = "",
}: {
  initialQuery?: string;
  initialTopic?: string;
  initialQuick?: string;
}) {
  const decisions = useDecisions();
  const [query, setQuery] = useState(initialQuery);
  const [organization, setOrganization] = useState("");
  const [topic, setTopic] = useState(initialTopic);
  const [status, setStatus] = useState("");
  const [quick, setQuick] = useState(initialQuick);
  const [visibleCount, setVisibleCount] = useState(18);
  const { preferences } = usePreferences();
  const topics = useMemo(() => [...new Set(decisions.map((decision) => decision.topic))].sort(), [decisions]);
  const recentCutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const filtered = useMemo(() => decisions.filter((decision) => {
    const searchable = `${decision.title} ${decision.summary} ${decision.topic} ${orgNames[decision.organization]} ${decision.sources.map((source) => source.title).join(" ")}`.toLowerCase();
    const matchesQuick = !quick
      || (quick === "area" && decision.affectedZipCodes.includes(preferences.zipCode))
      || (quick === "role" && decision.affectedRoles.some((role) => preferences.roles.includes(role)))
      || (quick === "recent" && decision.updatedAt >= recentCutoff)
      || (quick === "awaiting" && ["Public feedback", "Under review", "Scheduled for vote"].includes(decision.status))
      || (quick === "approved" && ["Approved", "Funded"].includes(decision.status))
      || (quick === "decided" && isDecidedStatus(decision.status))
      || (quick === "implementation" && decision.status === "Implementation");
    return (!query || searchable.includes(query.toLowerCase()))
      && (!organization || decision.organization === organization)
      && (!topic || decision.topic === topic)
      && (!status || decision.status === status)
      && matchesQuick;
  }), [decisions, query, organization, topic, status, quick, preferences, recentCutoff]);

  const shown = filtered.slice(0, visibleCount);
  const hasFilters = Boolean(query || organization || topic || status || quick);

  useEffect(() => {
    setVisibleCount(18);
  }, [query, organization, topic, status, quick]);
  const reset = () => {
    setQuery("");
    setOrganization("");
    setTopic("");
    setStatus("");
    setQuick("");
  };

  return (
    <div className="explore-index">
      <section className="explore-console" aria-label="Search and filter the public record">
        <div className="explore-console__mast">
          <div className="explore-console__identity">
            <span className="explore-console__mark"><Landmark size={20} aria-hidden="true" /></span>
            <div><p>THE PUBLIC INDEX</p><span>Charlotte · Mecklenburg · Durham · CMS</span></div>
          </div>
          <p className="explore-console__promise">A public record, in plain sight.</p>
        </div>
        <label className="explore-search">
          <span className="sr-only">Search decisions</span>
          <Search size={21} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a project, street, policy, or topic…" />
          {query ? <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><X size={18} /></button> : <kbd aria-hidden="true">SEARCH</kbd>}
        </label>
        <div className="explore-quick" aria-label="Quick filters">
          {quickFilters.map((filter) => (
            <button key={filter.value || "all"} type="button" aria-pressed={quick === filter.value} onClick={() => setQuick(filter.value)}>
              {filter.label}
            </button>
          ))}
        </div>
        <details className="explore-advanced">
          <summary><SlidersHorizontal size={16} aria-hidden="true" /> Fine-tune the record <span>Government · subject · stage</span></summary>
          <div className="explore-advanced__grid">
            <Select value={organization} set={setOrganization} label="Government body" icon={<Filter size={14} />}>
              <option value="">All governments</option>
              {Object.entries(orgNames).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </Select>
            <Select value={topic} set={setTopic} label="Subject">
              <option value="">All subjects</option>
              {topics.map((value) => <option key={value}>{value}</option>)}
            </Select>
            <Select value={status} set={setStatus} label="Stage">
              <option value="">All stages</option>
              {statuses.map((value) => <option key={value}>{value}</option>)}
            </Select>
            <Select value={quick === "role" || quick === "implementation" || quick === "decided" ? quick : ""} set={setQuick} label="More filters">
              <option value="">Any relevance</option>
              <option value="role">Relevant to my role</option>
              <option value="decided">Recorded outcomes</option>
              <option value="implementation">In implementation</option>
            </Select>
          </div>
        </details>
      </section>

      <div className="explore-results">
        <div>
          <p className="explore-results__eyebrow">{hasFilters ? "YOUR SEARCH" : "THE LATEST RECORD"}</p>
          <p className="explore-results__count"><strong>{filtered.length.toLocaleString("en-US")}</strong><span>{filtered.length === 1 ? "record" : "records"} {hasFilters ? "match" : "in the index"}</span></p>
        </div>
        <div className="explore-results__meta" aria-live="polite">
          <span>{hasFilters ? "Filters update as you choose them" : "Linked to official sources"}</span>
          {hasFilters && <button type="button" onClick={reset}><X size={15} /> Clear filters</button>}
        </div>
      </div>

      {shown.length ? (
        <>
        <div className="explore-grid">
          {shown.map((decision, index) => (
            <div className={index === 0 ? "explore-grid__lead" : undefined} key={decision.id}>
              <DecisionCard decision={decision} />
            </div>
          ))}
        </div>
        {filtered.length > shown.length && (
          <div className="explore-load-more">
            <p>Showing {shown.length.toLocaleString("en-US")} of {filtered.length.toLocaleString("en-US")} records</p>
            <button type="button" onClick={() => setVisibleCount((count) => Math.min(count + 18, filtered.length))}>
              Load 18 more records <ArrowUpRight size={16} aria-hidden="true" />
            </button>
          </div>
        )}
        </>
      ) : (
        <div className="explore-empty">
          <span><Search size={22} aria-hidden="true" /></span>
          <p className="eyebrow">No matching records</p>
          <h2>Try another way into the record.</h2>
          <p>Broaden the search or remove a filter to see more tracked decisions.</p>
          <button className="btn btn-primary" type="button" onClick={reset}>Show all records <ArrowUpRight size={17} /></button>
        </div>
      )}
    </div>
  );
}

function Select({ value, set, label, children, icon }: { value: string; set: (value: string) => void; label: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <label className="explore-select">
      <span>{label}</span>
      <span className="explore-select__control">{icon}<select value={value} onChange={(event) => set(event.target.value)}>{children}</select></span>
    </label>
  );
}
