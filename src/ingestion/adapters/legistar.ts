import { importance, plain, statusFromAction, topicFromText } from "../normalize";
import type { NormalizedItem, SourceConfig } from "../types";

type ApiRow = Record<string, unknown>;

const API_URL = "https://webapi.legistar.com/v1";

async function getJson(url: string): Promise<ApiRow[]> {
  const response = await fetch(url, {
    headers: { "user-agent": "CivicLens/1.0 official-record monitor" },
  });

  if (!response.ok) throw new Error(`${response.status} from ${url}`);
  return response.json() as Promise<ApiRow[]>;
}

export async function collectLegistar(
  source: SourceConfig,
  since: string,
  until?: string,
): Promise<{ documents: ApiRow[]; items: NormalizedItem[] }> {
  const dateFilter = until
    ? `EventDate ge datetime'${since}' and EventDate le datetime'${until}'`
    : `EventDate ge datetime'${since}'`;
  const query = new URLSearchParams({
    "$filter": dateFilter,
    "$orderby": "EventDate desc",
    "$top": "200",
  });

  const events = await getJson(`${API_URL}/${source.client}/events?${query}`);
  const documents: ApiRow[] = [];
  const items: NormalizedItem[] = [];

  for (const event of events) {
    const eventId = String(event.EventId);
    const eventDate = String(event.EventDate).slice(0, 10);
    documents.push(event);

    const rows = await getJson(`${API_URL}/${source.client}/events/${eventId}/eventitems`);

    for (const row of rows) {
      const title = plain(row.EventItemTitle || row.EventItemMatterName);
      const body = plain(
        [row.EventItemAgendaNote, row.EventItemActionText, row.EventItemMinutesNote]
          .filter(Boolean)
          .join(" "),
      );
      const score = importance(`${title} ${body}`);

      if (title.length < 12 || score < 2) continue;

      const matterFile = String(row.EventItemMatterFile || "");
      const officialUrl = /^https?:\/\//i.test(matterFile)
        ? matterFile
        : String(event.EventAgendaFile || source.url);
      const fallbackId = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80);
      const entityId = String(
        row.EventItemMatterId ||
          (/^[-\w]+$/.test(matterFile) && matterFile ? matterFile : fallbackId),
      );

      items.push({
        sourceKey: source.key,
        organization: source.organization,
        externalId: String(row.EventItemId),
        entityId,
        documentExternalId: eventId,
        title,
        body,
        url: officialUrl,
        eventDate,
        status: statusFromAction(
          row.EventItemActionName || row.EventItemActionText,
          row.EventItemPassedFlag,
          eventDate,
        ),
        actionText: plain(row.EventItemActionText),
        importanceScore: score,
        confidence: 0.9,
        topic: topicFromText(`${title} ${body}`),
      });
    }
  }

  return { documents, items };
}
