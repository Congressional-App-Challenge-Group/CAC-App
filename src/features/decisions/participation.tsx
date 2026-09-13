import { CalendarClock, Mail, Megaphone, UserRound } from "lucide-react";
import type { Decision } from "@/types";
import { govSources } from "@/lib/sources";
import { Surface } from "@/components/ui/card";

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

/**
 * Participation panel.
 *
 * Deliberately conservative: it reports only dates and representatives the
 * official data confirms, and points to the authoritative meeting calendar for
 * comment windows and sign-up procedure. CivicLens does not infer deadlines.
 */
export function ParticipationPanel({ decision }: { decision: Decision }) {
  const source = govSources.find((entry) => entry.organization === decision.organization);
  const dates = decision.importantDates ?? [];
  const geography = decision.geography;
  const district = geography?.councilDistrict;
  const rep = geography?.councilDistrictRep;
  const repEmail = geography?.councilDistrictRepEmail;

  return (
    <Surface className="p-5 text-sm">
      <div className="flex items-center gap-2 font-extrabold text-ink">
        <Megaphone size={17} className="text-civic" aria-hidden="true" />
        How to take part
      </div>

      {dates.length ? (
        <ul className="mt-4 space-y-2 border-t border-line pt-4">
          {dates.slice(0, 3).map((date) => (
            <li key={`${date.date}-${date.label}`} className="flex items-start gap-2">
              <CalendarClock size={14} className="mt-0.5 shrink-0 text-civic" aria-hidden="true" />
              <span className="text-ink-soft">
                <b className="text-ink">{formatDate(date.date)}</b> — {date.label}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 leading-6 text-muted">
          The official record does not confirm an upcoming meeting date for this item.
        </p>
      )}

      {decision.nextStep ? (
        <p className="mt-3 leading-6 text-ink-soft">
          <b className="text-ink">Confirmed next step:</b> {decision.nextStep}
        </p>
      ) : null}

      {district ? (
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-subtle">
            Council district
          </p>
          <p className="mt-2 flex items-start gap-2 text-ink-soft">
            <UserRound size={14} className="mt-0.5 shrink-0 text-civic" aria-hidden="true" />
            <span>
              <b className="text-ink">District {district}</b>
              {rep ? ` — ${rep}` : ""}
            </span>
          </p>
          {repEmail ? (
            <a
              href={`mailto:${repEmail}`}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-extrabold text-civic hover:text-civic-strong"
            >
              <Mail size={12} aria-hidden="true" />
              {repEmail}
            </a>
          ) : null}
        </div>
      ) : null}

      <p className="mt-4 border-t border-line pt-4 text-xs leading-5 text-subtle">
        Comment windows and speaker sign-up are set by the meeting body, not by CivicLens. Check the
        official calendar to confirm times and procedure.
      </p>

      {source ? (
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer noopener"
          className="btn btn-secondary mt-3 w-full text-sm"
        >
          {source.name} meeting calendar
        </a>
      ) : null}
    </Surface>
  );
}
