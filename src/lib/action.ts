import type { Decision } from "@/types";
import { isDecidedStatus, isOpenStatus } from "@/types";
import { CIVIC_TIME_ZONE, dateOnly, daysUntil, formatDeadlineDate, nextDeadline } from "./deadlines";
import { govSources } from "./sources";
import { decisionPlaceCodes, placeKindMeta, placeLabel, type PlaceKind } from "./place";

/**
 * The action layer.
 *
 * The tracker tells a resident what is happening. The deadline engine tells them
 * how long they have. Neither answers the only question left: *what do I
 * actually do about it?* This module turns one record into a short list of
 * concrete, checkable actions.
 *
 * The discipline that makes it trustworthy is the same one used everywhere else:
 * an action is only ever offered when the official record supports it.
 *
 *   - No published meeting date → no "attend the meeting" action, because there
 *     is no meeting to attend. The action becomes "ask when it will be heard."
 *   - No named representative with an address → no "write to them" action.
 *   - An already-decided matter → no comment action at all, because the window is
 *     closed and pretending otherwise wastes a resident's time.
 *
 * A page that always offers five calls to action is a page that lies about four
 * of them.
 */

/* -------------------------------------------------------------------------- */
/* Who decides                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The body that votes on this record.
 *
 * Taken from the publishing organization, which is the one piece of evidence
 * that is always present and always correct: Charlotte's Legistar publishes what
 * the City Council decides, CMS's board documents publish what the Board of
 * Education decides.
 */
export function decidingBody(decision: Pick<Decision, "organization">): string {
  switch (decision.organization) {
    case "charlotte":
      return "Charlotte City Council";
    case "mecklenburg-county":
      return "Mecklenburg Board of County Commissioners";
    case "durham-county":
      return "Durham County Board of Commissioners";
    case "cms":
      return "CMS Board of Education";
  }
}

/** The official page where this body's meetings and agendas are published. */
export function officialChannel(decision: Pick<Decision, "organization">): {
  name: string;
  url: string;
} | null {
  const source = govSources.find((entry) => entry.organization === decision.organization);
  return source ? { name: source.name, url: source.url } : null;
}

/** A representative the record itself names, with a way to reach them. */
export type Representative = { name: string; email?: string; district: string; role: string };

/**
 * Representatives named by the county's own boundary layers for this record.
 *
 * Only people the record can actually reach are returned — a name with no email
 * is reported separately by the interface as "no published address", because an
 * action reading "email your council member" with no address on it is not an
 * action.
 */
export function representativesFor(
  decision: Pick<Decision, "geography">,
): Representative[] {
  const geography = decision.geography;
  if (!geography) return [];

  const people: Representative[] = [];
  if (geography.councilDistrictRep || geography.councilDistrictRepEmail) {
    people.push({
      name: geography.councilDistrictRep ?? "Your council member",
      email: geography.councilDistrictRepEmail,
      // placeLabel keeps the district named the same way here as on the district
      // panel, so one seat is never spelled two different ways on one page.
      district:
        geography.councilDistrict !== undefined
          ? placeLabel("council", String(geography.councilDistrict))
          : placeKindMeta.council.name,
      role: placeKindMeta.council.body,
    });
  }
  if (geography.countyDistrictRep || geography.countyDistrictRepEmail) {
    people.push({
      name: geography.countyDistrictRep ?? "Your county commissioner",
      email: geography.countyDistrictRepEmail,
      district:
        geography.countyDistrict !== undefined
          ? placeLabel("county", String(geography.countyDistrict))
          : placeKindMeta.county.name,
      role: placeKindMeta.county.body,
    });
  }
  return people;
}

/* -------------------------------------------------------------------------- */
/* Actions                                                                     */
/* -------------------------------------------------------------------------- */

export type ActionKind = "attend" | "comment" | "contact" | "ask" | "read";

export type CivicAction = {
  kind: ActionKind;
  /** What the resident does, in the imperative. */
  title: string;
  /** Why, and what the record says to support it. */
  detail: string;
  href?: string;
  /** Email address, for a mailto action. */
  to?: string;
  /** The date this stops being possible. */
  dueBy?: string;
  /** Short label for the channel, e.g. "Email" or "Official calendar". */
  via?: string;
};

/**
 * What this resident can actually do, most urgent first.
 *
 * At most four actions are returned. A list longer than that is not a plan, and
 * the fourth-most useful thing to do about a rezoning is nothing.
 */
export function actionsFor(decision: Decision, now: Date = new Date()): CivicAction[] {
  const actions: CivicAction[] = [];
  const body = decidingBody(decision);
  const channel = officialChannel(decision);
  const deadline = nextDeadline(decision, now);
  const days = deadline?.date ? daysUntil(deadline.date, now) : Number.NaN;
  const decided = isDecidedStatus(decision.status);
  const open = isOpenStatus(decision.status);

  const meetingDate = decision.importantDates?.[0]?.date;

  /* 1. A scheduled decision in the future is the one thing worth acting on. */
  if (open && deadline?.date && Number.isFinite(days) && days >= 0) {
    actions.push({
      kind: "attend",
      title:
        days === 0
          ? `${body} meets today about this`
          : `${body} acts on this ${formatDeadlineDate(deadline.date)}`,
      detail:
        `The official record puts the next action on ${formatDeadlineDate(deadline.date)}` +
        (deadline.officialStatus ? `, with the register listing it as “${deadline.officialStatus}”.` : ".") +
        " Public comment is usually taken at the meeting itself, and sign-up is handled by the clerk.",
      href: deadline.sourceUrl || channel?.url,
      dueBy: deadline.date,
      via: deadline.sourceUrl ? "The government's own record" : "Official calendar",
    });
  }

  /* 2. A representative with a published address is a real, direct channel. */
  const people = representativesFor(decision).filter((person) => person.email);
  const person = people[0];
  if (person?.email && !decided) {
    actions.push({
      kind: "contact",
      title: `Write to ${person.name}`,
      detail:
        `${person.name} holds ${person.district} for ${person.role}, which is the seat this record sits in. ` +
        "Constituent mail is read by the member's office and becomes part of the record they weigh.",
      to: person.email,
      href: `mailto:${person.email}?subject=${encodeURIComponent(emailSubject(decision))}&body=${encodeURIComponent(commentStarter(decision))}`,
      via: "Email",
    });
  }

  /* 3. Open but undated: the honest action is to ask when it will be heard. */
  if (open && !deadline?.date && channel) {
    actions.push({
      kind: "ask",
      title: `Ask when ${body} will hear this`,
      detail:
        "The record states no date for the next action, so there is nothing to attend yet. " +
        `${channel.name} publishes agendas before each meeting; the item will appear there before it is decided.`,
      href: channel.url,
      via: "Official calendar",
    });
  }

  /* 4. A meeting date the record states but the register does not. */
  if (open && !deadline?.date && meetingDate && dateOnly(meetingDate)) {
    actions.push({
      kind: "attend",
      title: `Listed for ${formatDeadlineDate(meetingDate)}`,
      detail: `The record's own date list puts this on ${formatDeadlineDate(meetingDate)}. Confirm with the clerk before travelling.`,
      href: channel?.url,
      dueBy: meetingDate,
      via: "Official record",
    });
  }

  /* 5. Decided matters: read what happened, then ask the body about it. */
  if (decided) {
    actions.push({
      kind: "read",
      title: "Read what was decided",
      detail: `This record is ${decision.status.toLowerCase()}. ${
        decision.approvedAt ? `The register dates the action to ${formatDeadlineDate(decision.approvedAt)}. ` : ""
      }The official sources below are the record of it.`,
      href: decision.sources[0]?.url,
      via: "Official source",
    });
    if (channel) {
      actions.push({
        kind: "contact",
        title: `Ask ${body} how it is being carried out`,
        detail:
          "A decision is not the end of the process. Implementation questions go to the body that voted.",
        href: channel.url,
        via: "Official calendar",
      });
    }
  }

  /* 6. Never leave the reader with nothing at all. */
  if (!actions.length && channel) {
    actions.push({
      kind: "read",
      title: `Follow this on ${channel.name}`,
      detail:
        "The record does not state a date or a representative to contact, so the reliable next step is the body's own calendar.",
      href: channel.url,
      via: "Official calendar",
    });
  }

  return actions.slice(0, 4);
}

function emailSubject(decision: Pick<Decision, "title">): string {
  return `Comment on: ${decision.title}`;
}

/* -------------------------------------------------------------------------- */
/* Comment starter                                                             */
/* -------------------------------------------------------------------------- */

/**
 * A comment the resident can actually send.
 *
 * It is a *template*, not a finished message: the only lines that are filled in
 * are the ones the official record states. The part that matters — what the
 * resident thinks — is left blank on purpose. Generating an opinion and
 * attributing it to a member of the public would be the single most dishonest
 * thing this product could do.
 */
export function commentStarter(decision: Decision): string {
  const lines: string[] = [];
  const place = describeRecordPlace(decision);
  const where = decision.geography?.address ?? decision.geography?.neighborhood;
  const meetingDate = decision.importantDates?.[0];

  lines.push(
    `I am writing about “${decision.title}”, which the official record lists as ${decision.status.toLowerCase()}.`,
  );
  /*
   * Every location is attributed to the *record*, never to the writer.
   *
   * An earlier draft read "I live in 8212 Douglas Dr" — but that address is the
   * one the decision concerns. A resident would have sent their council member a
   * message claiming to live at a rezoning site. The generated part may only
   * repeat what the government published; the writer's own details stay as
   * bracketed prompts for them to fill in.
   */
  if (where || place) {
    lines.push(`The record places this at ${[where, place].filter(Boolean).join(", ")}.`);
  }
  if (decision.latestUpdate) {
    lines.push(`The record states: ${decision.latestUpdate}`);
  }
  if (meetingDate) {
    lines.push(`I understand it is next scheduled for ${meetingDate.date}.`);
  }
  lines.push("");
  lines.push("I live in [your street or neighbourhood] and this is in my area.");
  lines.push("");
  lines.push("My comment:");
  lines.push("");
  // The record's ZIP is deliberately not printed here: the signature is the
  // writer's, and the ZIP on the record is where the decision sits, not where
  // they live.
  lines.push("— [your name], ZIP [your ZIP code]");
  lines.push(
    `(Source: ${decidingBody(decision)} record ${decision.id}${decision.sources[0]?.url ? ` — ${decision.sources[0].url}` : ""})`,
  );

  return lines.join("\n");
}

/** The districts a record sits in, named the way a resident would say them. */
export function describeRecordPlace(decision: Pick<Decision, "geography">): string {
  const codes = decisionPlaceCodes(decision.geography);
  const parts: string[] = [];
  for (const kind of ["council", "county", "school"] as PlaceKind[]) {
    if (codes[kind]) parts.push(placeLabel(kind, codes[kind] as string));
  }
  return parts.join(", ");
}

/* -------------------------------------------------------------------------- */
/* Calendar export                                                             */
/* -------------------------------------------------------------------------- */

/** Actions an exported calendar event can carry. */
export type CalendarEvent = {
  uid: string;
  date: string;
  summary: string;
  description: string;
  url?: string;
};

/**
 * The events worth exporting for a record: a scheduled action, and any other
 * dated step the record states.
 *
 * Dates are exported as all-day events deliberately. The record gives a day, not
 * a time, and inventing a 9am start would have residents arriving at an empty
 * chamber. The description tells them to confirm with the clerk.
 */
export function calendarEventsFor(decision: Decision, now: Date = new Date()): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const seen = new Set<string>();

  const deadline = nextDeadline(decision, now);
  if (deadline?.date) {
    seen.add(deadline.date);
    events.push({
      uid: `${decision.id}-action-${deadline.date}`,
      date: deadline.date,
      summary: `${decidingBody(decision)}: ${decision.title}`.slice(0, 200),
      description: calendarDescription(decision),
      url: deadline.sourceUrl ?? decision.sources[0]?.url,
    });
  }

  for (const entry of decision.importantDates ?? []) {
    const day = dateOnly(entry.date);
    if (!day || seen.has(day)) continue;
    seen.add(day);
    events.push({
      uid: `${decision.id}-date-${day}`,
      date: day,
      summary: `${entry.label || decidingBody(decision)}: ${decision.title}`.slice(0, 200),
      description: calendarDescription(decision),
      url: decision.sources[0]?.url,
    });
  }

  return events;
}

function calendarDescription(decision: Decision): string {
  return [
    decision.summary,
    "",
    `Stage: ${decision.status}.`,
    decision.geography?.address ? `Location on record: ${decision.geography.address}.` : "",
    describeRecordPlace(decision) ? `Districts: ${describeRecordPlace(decision)}.` : "",
    "",
    "Times are set by the meeting body, not by CivicLens — confirm the start time with the clerk.",
    decision.sources[0]?.url ? `Official source: ${decision.sources[0].url}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/* -------------------------------------------------------------------------- */
/* iCalendar serialisation                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Escape a value for an iCalendar TEXT field.
 *
 * Backslash first, or the escapes added afterwards would themselves be escaped.
 * RFC 5545 requires commas, semicolons and newlines to be escaped because they
 * are the field separators.
 */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Fold a content line to 75 octets, as RFC 5545 requires.
 *
 * Continuation lines begin with a single space. Measured in *octets*, not
 * characters, because a title containing an em dash or a curly quote would
 * otherwise overflow the limit and some calendar clients would truncate the
 * event.
 */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const out: string[] = [];
  let current = "";
  let currentBytes = 0;
  // The first line allows 75 octets; continuations allow 74 plus the leading space.
  let limit = 75;

  for (const character of line) {
    const size = encoder.encode(character).length;
    if (currentBytes + size > limit) {
      out.push(current);
      current = character;
      currentBytes = size;
      limit = 74;
    } else {
      current += character;
      currentBytes += size;
    }
  }
  if (current) out.push(current);

  return out.join("\r\n ");
}

/** `20260915` — the DATE form of an iCalendar value. */
export function icsDate(date: string): string {
  return (dateOnly(date) ?? date).replace(/-/g, "");
}

/** `20260915T221500Z` — the UTC DATE-TIME form, used for DTSTAMP. */
export function icsTimestamp(now: Date): string {
  return `${now.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
}

/**
 * A complete calendar file for a set of events.
 *
 * Exported as all-day events. A calendar entry that says "9:00 AM" when the
 * record only ever stated a date is a fabricated detail a resident would act on.
 */
export function toIcs(
  events: CalendarEvent[],
  options: { name?: string; now?: Date; timeZone?: string } = {},
): string {
  const now = options.now ?? new Date();
  const stamp = icsTimestamp(now);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CivicLens//CivicLens//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(options.name ?? "CivicLens")}`,
    `X-WR-TIMEZONE:${options.timeZone ?? CIVIC_TIME_ZONE}`,
  ];

  for (const event of events) {
    const day = icsDate(event.date);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeIcsText(event.uid)}@civiclens`,
      `DTSTAMP:${stamp}`,
      // All-day: DTSTART as a DATE with an exclusive end date one day later.
      `DTSTART;VALUE=DATE:${day}`,
      `DTEND;VALUE=DATE:${nextDay(event.date)}`,
      `SUMMARY:${escapeIcsText(event.summary)}`,
      `DESCRIPTION:${escapeIcsText(event.description)}`,
      ...(event.url ? [`URL:${escapeIcsText(event.url)}`] : []),
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

/** The day after `date`, for the exclusive end of an all-day event. */
function nextDay(date: string): string {
  const day = dateOnly(date) ?? date;
  const [year, month, dateOfMonth] = day.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, dateOfMonth + 1));
  return next.toISOString().slice(0, 10).replace(/-/g, "");
}

/** A filename a person would recognise in their downloads folder. */
export function icsFilename(decision: Pick<Decision, "slug">): string {
  return `${decision.slug.slice(0, 60)}.ics`;
}
