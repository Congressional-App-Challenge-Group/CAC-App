import { Building2, ExternalLink, MapPin, ShieldCheck } from "lucide-react";
import type { CivicSource, DecisionGeography } from "@/types";
import { confidenceLabel, methodLabel } from "@/lib/geography";
import { Badge, VerificationBadge } from "./badge";

function formatTimestamp(value?: string | null): string {
  if (!value) return "not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "not recorded";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The trust surface. CivicLens' whole claim is that every statement traces back
 * to an official record, so this panel shows exactly that: the sources, their
 * verification state, when we last checked, and where any location came from.
 */
export function ProvenancePanel({
  sources,
  lastCheckedAt,
  geography,
  requester,
  officialStatus,
}: {
  sources: CivicSource[];
  lastCheckedAt?: string | null;
  geography?: DecisionGeography;
  /** Who the government's own register names as the requester. */
  requester?: string;
  /** The register's stage label, quoted verbatim. */
  officialStatus?: string;
}) {
  return (
    <div className="surface p-5 text-sm">
      <div className="flex items-center gap-2 font-extrabold text-ink">
        <ShieldCheck size={17} className="text-civic" />
        How we know this
      </div>

      <p className="mt-3 leading-6 text-muted">
        Every statement on this page is drawn from the official records below. Where a record does
        not confirm something — a cost, a date, an affected area — CivicLens leaves it blank rather
        than guessing.
      </p>

      <dl className="mt-4 space-y-2 border-t border-line pt-4 text-xs">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-subtle">Last checked</dt>
          <dd className="font-bold text-ink-soft">{formatTimestamp(lastCheckedAt)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-subtle">Official sources</dt>
          <dd className="font-bold text-ink-soft">
            {sources.length} attached
          </dd>
        </div>
        {officialStatus ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-subtle">Register says</dt>
            <dd className="font-bold text-ink-soft">“{officialStatus}”</dd>
          </div>
        ) : null}
      </dl>

      {requester ? (
        <div className="mt-4 border-t border-line pt-4">
          <div className="flex items-center gap-2 text-xs font-extrabold text-ink">
            <Building2 size={14} className="text-civic" aria-hidden="true" />
            Requested by
          </div>
          <p className="mt-2 text-xs leading-5 text-muted">
            <b className="text-ink-soft">{requester}</b> — as named in the government&apos;s own
            matter register.
          </p>
        </div>
      ) : null}

      {sources.length ? (
        <ul className="mt-4 space-y-2 border-t border-line pt-4">
          {sources.slice(0, 4).map((source) => (
            <li key={source.id}>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer noopener"
                className="group flex items-start gap-2 text-xs font-bold text-civic hover:text-civic-strong"
              >
                <ExternalLink size={13} className="mt-0.5 shrink-0" />
                <span className="underline decoration-civic/30 underline-offset-2 group-hover:decoration-civic">
                  {source.title}
                </span>
              </a>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-5">
                <span className="text-[11px] text-subtle">
                  {source.organization}
                  {source.pageReference ? ` · ${source.pageReference}` : ""}
                </span>
                <VerificationBadge status={source.verificationStatus} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 border-t border-line pt-4 text-xs text-muted">
          No external official source is attached to this record yet.
        </p>
      )}

      {geography ? (
        <div className="mt-4 border-t border-line pt-4">
          <div className="flex items-center gap-2 text-xs font-extrabold text-ink">
            <MapPin size={14} className="text-civic" />
            Location
          </div>
          <p className="mt-2 text-xs leading-5 text-muted">{methodLabel(geography.method)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={geography.confidence === "exact" ? "success" : geography.confidence === "likely" ? "info" : "warning"}>
              {confidenceLabel(geography.confidence)}
            </Badge>
            {geography.zipCode ? <Badge tone="neutral">ZIP {geography.zipCode}</Badge> : null}
            {geography.councilDistrict ? (
              <Badge tone="neutral">District {geography.councilDistrict}</Badge>
            ) : null}
            {geography.acres ? (
              <Badge tone="neutral">{geography.acres.toFixed(2)} acres</Badge>
            ) : null}
            {geography.neighborhood ? (
              <Badge tone="neutral">{geography.neighborhood}</Badge>
            ) : null}
          </div>
          {geography.sourceUrl ? (
            <a
              href={geography.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-extrabold text-civic hover:text-civic-strong"
            >
              <ExternalLink size={12} />
              Official parcel / petition record
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
