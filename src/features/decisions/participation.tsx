import {
  CalendarClock,
  CalendarPlus,
  CircleHelp,
  ExternalLink,
  Mail,
  Megaphone,
  Send,
  UserRound,
} from "lucide-react";
import type { Decision } from "@/types";
import {
  actionsFor,
  calendarEventsFor,
  commentStarter,
  decidingBody,
  representativesFor,
  type ActionKind,
  type CivicAction,
} from "@/lib/action";
import { govSources } from "@/lib/sources";
import { Surface } from "@/components/ui/card";

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

const ICONS: Record<ActionKind, React.ReactNode> = {
  attend: <CalendarClock size={16} aria-hidden="true" />,
  comment: <Send size={16} aria-hidden="true" />,
  contact: <Mail size={16} aria-hidden="true" />,
  ask: <CircleHelp size={16} aria-hidden="true" />,
  read: <ExternalLink size={16} aria-hidden="true" />,
};

/**
 * One action, with the evidence attached.
 *
 * Each row states the channel it uses ("Email", "Official calendar") because an
 * action is only trustworthy when the reader can see where it goes. A row whose
 * channel is a representative's mailto also carries a comment starter, so the
 * hardest part — the blank page — is already handled.
 */
function ActionRow({ action }: { action: CivicAction }) {
  const external = action.href && !action.href.startsWith("mailto:");

  return (
    <li className="flex items-start gap-3 border-t border-line py-3.5 first:border-t-0 first:pt-0">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-civic-strong">
        {ICONS[action.kind]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-extrabold leading-snug text-ink">{action.title}</p>
        <p className="mt-1.5 text-[13px] leading-5 text-muted">{action.detail}</p>
        {action.href ? (
          <a
            href={action.href}
            {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-extrabold text-civic hover:text-civic-strong"
          >
            {action.kind === "contact" ? `Email ${action.to}` : (action.via ?? "Open")}
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        ) : null}
        {action.dueBy ? (
          <p className="mt-1.5 text-xs text-subtle">
            Act by {formatDate(action.dueBy)}. Times are set by the meeting body.
          </p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The action panel.
 *
 * This replaces the older participation panel, which listed dates and a mailto
 * but left the reader to work out what to do with them. Every row here comes
 * from the action layer, which only offers an action the official record
 * supports — and the panel says plainly what is *not* on offer, because "we
 * cannot tell you who to write to" is a real answer.
 */
export function ParticipationPanel({ decision }: { decision: Decision }) {
  const source = govSources.find((entry) => entry.organization === decision.organization);
  const actions = actionsFor(decision);
  const events = calendarEventsFor(decision);
  const dates = decision.importantDates ?? [];
  const unnamed = representativesFor(decision).filter((person) => !person.email);

  return (
    <Surface className="p-5 text-sm">
      <div className="flex items-center gap-2 font-extrabold text-ink">
        <Megaphone size={17} className="text-civic" aria-hidden="true" />
        What you can do
      </div>
      <p className="mt-1.5 text-xs leading-5 text-subtle">
        Every action below is supported by {decidingBody(decision)}&apos;s own record. Nothing here is
        inferred.
      </p>

      <ul className="mt-4 border-t border-line pt-4">
        {actions.map((action) => (
          <ActionRow key={`${action.kind}-${action.title}`} action={action} />
        ))}
      </ul>

      {events.length ? (
        <a
          href={`/api/calendar/${decision.slug}`}
          className="btn btn-secondary mt-4 w-full text-sm"
        >
          <CalendarPlus size={15} aria-hidden="true" />
          Add {events.length === 1 ? "the date" : `${events.length} dates`} to your calendar
        </a>
      ) : (
        <p className="mt-4 border-t border-line pt-4 text-xs leading-5 text-subtle">
          The record states no scheduled date, so there is nothing to add to a calendar yet.
        </p>
      )}

      {dates.length ? (
        <ul className="mt-4 space-y-2">
          {dates.slice(0, 3).map((date) => (
            <li key={`${date.date}-${date.label}`} className="flex items-start gap-2">
              <CalendarClock size={14} className="mt-0.5 shrink-0 text-civic" aria-hidden="true" />
              <span className="text-ink-soft">
                <b className="text-ink">{formatDate(date.date)}</b> — {date.label}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {unnamed.length ? (
        <p className="mt-4 border-t border-line pt-4 text-xs leading-5 text-subtle">
          <UserRound size={12} className="mr-1 inline align-[-2px] text-civic" aria-hidden="true" />
          This record sits in {unnamed[0].district}, whose seat is{" "}
          <b className="text-ink-soft">{unnamed[0].name}</b> — but the county publishes no address for
          that seat, so CivicLens offers no email action rather than a dead one.
        </p>
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

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-extrabold text-civic hover:text-civic-strong">
          Start a comment from the record
        </summary>
        <p className="mt-2 text-xs leading-5 text-subtle">
          A template built only from what the official record states. The part that matters — your
          opinion — is left blank on purpose.
        </p>
        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-[11px] leading-5 text-ink-soft">
          {commentStarter(decision)}
        </pre>
      </details>
    </Surface>
  );
}
