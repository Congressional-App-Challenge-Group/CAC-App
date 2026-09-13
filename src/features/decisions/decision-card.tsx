"use client";

import Link from "next/link";
import { Bookmark, BookmarkCheck, CalendarClock, ChevronRight, Landmark, MapPin, PenLine } from "lucide-react";
import type { Decision } from "@/types";
import { orgNames } from "@/lib/civic";
import { locationHint } from "@/lib/enrichment";
import { usePreferences } from "@/features/preferences/preferences";
import { StatusBadge } from "@/components/ui/badge";
import { CountdownBadge } from "@/components/ui/deadline";
import { cn } from "@/lib/cn";

export function DecisionCard({ decision, reason }: { decision: Decision; reason?: string }) {
  const { following, toggleFollow } = usePreferences();
  const saved = following.includes(decision.id);
  const location = locationHint(decision);
  const date = new Date(decision.updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <article className="decision-card card flex h-full flex-col p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-subtle">
          <Landmark size={13} />
          {orgNames[decision.organization]}
        </span>
        <div className="flex flex-col items-end gap-1.5">
          <StatusBadge status={decision.status} />
          <CountdownBadge decision={decision} />
        </div>
      </div>

      <div className="mt-5">
        <p className="text-xs font-extrabold text-civic">{decision.topic}</p>
        <Link href={`/decisions/${decision.slug}`} className="block">
          <h3 className="mt-2 text-xl font-black leading-[1.15] tracking-[-0.035em] text-ink transition-colors hover:text-civic md:text-[1.35rem]">
            {decision.title}
          </h3>
        </Link>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">{decision.summary}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        {location ? (
          <span className="flex items-center gap-1.5 font-bold text-ink-soft">
            <MapPin size={13} className="text-civic" />
            {location}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-subtle">
            <MapPin size={13} />
            Location not confirmed
          </span>
        )}
        {decision.plainLanguageApproved ? (
          <span className="flex items-center gap-1.5 font-bold text-civic-strong">
            <PenLine size={13} />
            Editor-reviewed
          </span>
        ) : null}
      </div>

      {reason ? (
        <div className="mt-4 rounded-[var(--radius)] border border-civic/25 bg-civic/5 px-3 py-2.5 text-xs text-ink-soft">
          <b className="text-ink">Why you&apos;re seeing this:</b> {reason}
        </div>
      ) : null}

      <div className="mt-auto pt-5">
        <div className="flex items-center justify-between border-t border-line pt-4 text-xs text-subtle">
          <span className="flex items-center gap-1.5">
            <CalendarClock size={14} />
            Updated {date}
          </span>
          <button
            type="button"
            onClick={() => toggleFollow(decision.id)}
            aria-label={saved ? "Remove from following" : "Follow this decision"}
            aria-pressed={saved}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-extrabold transition-colors",
              saved ? "text-civic" : "text-ink-soft hover:bg-surface-2 hover:text-ink",
            )}
          >
            {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
            {saved ? "Following" : "Follow"}
          </button>
        </div>

        <Link
          href={`/decisions/${decision.slug}`}
          className="mt-4 flex items-center justify-between rounded-xl bg-ink px-4 py-3 text-sm font-extrabold text-paper transition-colors hover:bg-civic hover:text-on-civic"
        >
          View decision
          <ChevronRight size={17} />
        </Link>
      </div>
    </article>
  );
}
