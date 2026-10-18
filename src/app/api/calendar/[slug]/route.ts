import { getDecision } from "@/server/decisions";
import { calendarEventsFor, icsFilename, toIcs } from "@/lib/action";

export const revalidate = 300;

/**
 * Export a record's dated steps as a calendar file.
 *
 * Served as a real `.ics` download rather than an in-app reminder, because the
 * reminder a resident will actually see is the one on their own phone. The
 * dates are the government's, exported as all-day events — the record states a
 * day, not a time, and inventing one would have people arriving at an empty
 * chamber.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const decision = await getDecision(slug);

  if (!decision) {
    return new Response("No such record.", { status: 404 });
  }

  const events = calendarEventsFor(decision);

  if (!events.length) {
    // An empty calendar file downloads as a broken-looking event. Saying there is
    // nothing to add is more useful than an empty download.
    return new Response(
      "This record states no date for its next action, so there is nothing to add to a calendar.",
      { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  const body = toIcs(events, {
    name: `${decision.title.slice(0, 60)} — CivicLens`,
    now: new Date(),
  });

  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${icsFilename(decision)}"`,
      // The dates change at most a few times a day, and a stale calendar is
      // worse than a fresh one, so this is deliberately short.
      "cache-control": "public, max-age=300, s-maxage=300",
    },
  });
}
