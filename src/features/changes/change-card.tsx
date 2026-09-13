import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import type { DecisionChange } from "@/types";
import { changeFieldLabel } from "@/lib/changes";
import { orgNames } from "@/lib/civic";
import { Badge } from "@/components/ui/badge";

function relativeDay(value: string): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "recently";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Compact row form, used inside feed groups. */
export function ChangeLine({ change }: { change: DecisionChange }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
      <Badge tone="accent">{changeFieldLabel(change.field)}</Badge>
      {change.previous ? (
        <>
          <span className="text-subtle line-through decoration-subtle/60">{change.previous}</span>
          <ArrowRight size={13} className="shrink-0 text-civic" aria-hidden="true" />
        </>
      ) : null}
      <span className="font-bold text-ink">{change.current}</span>
    </li>
  );
}

export function ChangeCard({
  slug,
  title,
  organization,
  changes,
}: {
  slug: string;
  title: string;
  organization: DecisionChange["organization"];
  changes: DecisionChange[];
}) {
  const changedAt = changes[0]?.changedAt;
  const sourceUrl = changes.find((change) => change.sourceUrl)?.sourceUrl;

  return (
    <article className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-subtle">
        <span>{orgNames[organization]}</span>
        <span>{changedAt ? relativeDay(changedAt) : ""}</span>
      </div>

      <Link href={`/decisions/${slug}`}>
        <h3 className="mt-3 text-lg font-black leading-snug tracking-[-0.03em] text-ink transition-colors hover:text-civic">
          {title}
        </h3>
      </Link>

      <ul className="mt-4 space-y-2 border-t border-line pt-4">
        {changes.map((change) => (
          <ChangeLine key={change.id} change={change} />
        ))}
      </ul>

      <div className="mt-4 flex items-center justify-between text-xs font-extrabold">
        <Link href={`/decisions/${slug}`} className="text-civic hover:text-civic-strong">
          Open the record
        </Link>
        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-1.5 text-subtle transition-colors hover:text-ink"
          >
            Source
            <ExternalLink size={12} />
          </a>
        ) : null}
      </div>
    </article>
  );
}
