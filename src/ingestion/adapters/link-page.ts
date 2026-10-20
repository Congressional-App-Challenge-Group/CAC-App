import { createHash } from "node:crypto";
import type { SourceConfig } from "../types";

export async function collectLinkPage(source: SourceConfig) {
  const response = await fetch(source.url, {
    headers: { "user-agent": "CivicLens/1.0 official-record monitor" },
  });

  if (!response.ok) throw new Error(`${response.status} from ${source.url}`);

  const html = await response.text();
  const links = [...html.matchAll(/href=["']([^"']+)["']/gi)]
    .map((match) => match[1])
    .filter((href) => /agenda|minutes|policy|meeting|goto\?open/i.test(href))
    .map((href) => new URL(href.replace(/&amp;/g, "&"), source.url).toString());

  const pageId = createHash("sha256").update(html).digest("hex").slice(0, 24);

  return {
    documents: [
      {
        externalId: pageId,
        title: `${source.name} public records index`,
        url: source.url,
        html,
        links: [...new Set(links)].slice(0, 200),
      },
    ],
    items: [],
  };
}
