"use client";

import { useMemo, useState } from "react";
import { Building2, Check, ChevronDown, ChevronUp, Clock, History, TriangleAlert } from "lucide-react";
import type { TimelineEvent } from "@/types";
import { StatusBadge } from "@/components/ui/badge";
import { Stat } from "@/components/ui/stat";
import { cn } from "@/lib/cn";

const INITIAL_VISIBLE = 4;

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  const [expanded, setExpanded] = useState(false);

  const ordered = useMemo(
    () => [...events].sort((a, b) => b.date.localeCompare(a.date)),
    [events],
  );
  const visible = expanded ? ordered : ordered.slice(0, INITIAL_VISIBLE);
  const hidden = Math.max(0, ordered.length - INITIAL_VISIBLE);

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:flex">
        <Stat value={ordered.length} label="Recorded actions" />
        <Stat
          value={ordered[0] ? new Date(`${ordered[0].date}T12:00:00`).getFullYear().toString() : "—"}
          label="Latest year"
        />
      </div>

      <ol className="relative ml-3 border-l border-line-strong" aria-label="Decision history, newest first">
        {visible.map((event, index) => (
          <li className="relative mb-5 ml-7 last:mb-0" key={event.id}>
            <span
              className={cn(
                "absolute -left-[2.18rem] top-5 grid h-5 w-5 place-items-center rounded-full ring-4 ring-paper",
                index === 0 ? "bg-amber text-paper" : event.state === "delayed" ? "bg-danger text-paper" : "bg-civic text-on-civic",
              )}
              aria-hidden="true"
            >
              {index === 0 ? (
                <Clock size={11} />
              ) : event.state === "delayed" ? (
                <TriangleAlert size={11} />
              ) : (
                <Check size={11} />
              )}
            </span>

            <div className={cn("card p-5", index === 0 && "border-civic/40")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <time
                    dateTime={event.date}
                    className="text-xs font-extrabold uppercase tracking-[0.08em] text-civic"
                  >
                    {formatDate(event.date)}
                  </time>
                  {index === 0 ? (
                    <span className="rounded-full bg-ink px-2 py-1 text-[9px] font-black uppercase tracking-wider text-paper">
                      Latest
                    </span>
                  ) : null}
                </div>
                <StatusBadge status={event.stage} />
              </div>

              <h3 className="mt-3 text-lg font-black tracking-[-0.025em] text-ink">{event.title}</h3>
              {event.description ? (
                <p className="mt-2 text-sm leading-6 text-muted">{event.description}</p>
              ) : null}

              {event.whatChanged ? (
                <div className="mt-4 flex gap-2 rounded-[var(--radius)] border border-line bg-surface-2 px-3 py-2.5 text-sm">
                  <History size={15} className="mt-0.5 shrink-0 text-civic" aria-hidden="true" />
                  <p className="text-ink-soft">
                    <b className="text-ink">What changed:</b> {event.whatChanged}
                  </p>
                </div>
              ) : null}

              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-subtle">
                <Building2 size={12} aria-hidden="true" />
                {event.verificationStatus === "verified"
                  ? "Verified against the official record"
                  : event.verificationStatus === "reviewed"
                    ? "Reviewed by an editor"
                    : "Not yet confirmed"}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="btn btn-secondary ml-10 mt-5 text-sm"
        >
          {expanded ? (
            <>
              <ChevronUp size={16} />
              Show less
            </>
          ) : (
            <>
              <ChevronDown size={16} />
              Show {hidden} earlier {hidden === 1 ? "event" : "events"}
            </>
          )}
        </button>
      ) : null}
    </div>
  );
}
