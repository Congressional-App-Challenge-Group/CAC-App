"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Quote, X } from "lucide-react";
import type { DecisionDraft } from "@/types";
import { draftFieldLabels } from "@/lib/enrichment";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Group = { decisionId: string; drafts: DecisionDraft[] };

function groupDrafts(drafts: DecisionDraft[]): Group[] {
  const byDecision = new Map<string, DecisionDraft[]>();
  for (const draft of drafts) {
    const bucket = byDecision.get(draft.decisionId);
    if (bucket) bucket.push(draft);
    else byDecision.set(draft.decisionId, [draft]);
  }
  return [...byDecision.entries()].map(([decisionId, group]) => ({ decisionId, drafts: group }));
}

export function DraftQueue({ drafts }: { drafts: DecisionDraft[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function act(id: string, action: "approve" | "reject") {
    setBusy(id);
    setMessage("");
    try {
      const response = await fetch("/api/admin/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(payload.error ?? "That action failed.");
      } else {
        setMessage(
          action === "approve"
            ? "Approved — this text can now appear on the public record page."
            : "Rejected — the raw record wording stays in place.",
        );
        router.refresh();
      }
    } catch {
      setMessage("There was a network problem. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function generate(decisionId: string) {
    setBusy(`generate:${decisionId}`);
    setMessage("");
    try {
      const response = await fetch("/api/admin/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "generate", decisionId }),
      });
      const payload = (await response.json()) as { error?: string; created?: number };
      setMessage(
        response.ok
          ? `Generated ${payload.created ?? 0} drafts using ${payload.created ? "the configured model" : "templates"}.`
          : payload.error ?? "Generation failed.",
      );
      router.refresh();
    } catch {
      setMessage("There was a network problem. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const groups = groupDrafts(drafts);

  if (!groups.length) {
    return (
      <div className="card p-8 text-center">
        <h2 className="text-lg font-black text-ink">No drafts are waiting</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Run the plain-language job (<code className="rounded bg-surface-2 px-1.5 py-0.5">pnpm enrich:language</code>)
          or generate a draft from any decision below.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message ? (
        <p role="status" className="surface p-3 text-sm font-bold text-civic-strong">
          {message}
        </p>
      ) : null}

      {groups.map((group) => (
        <section key={group.decisionId} className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={`/decisions/${group.decisionId}`}
              className="text-sm font-extrabold text-civic hover:text-civic-strong"
            >
              {group.decisionId}
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => generate(group.decisionId)}
              disabled={busy === `generate:${group.decisionId}`}
            >
              {busy === `generate:${group.decisionId}` ? "Generating…" : "Generate more"}
            </Button>
          </div>

          <ul className="mt-4 space-y-4">
            {group.drafts.map((draft) => (
              <li key={draft.id} className="rounded-[var(--radius)] border border-line p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="accent">{draftFieldLabels[draft.field]}</Badge>
                  <Badge tone="neutral">{draft.model}</Badge>
                  <Badge tone="neutral">{draft.promptVersion}</Badge>
                </div>

                <p className="mt-3 text-sm leading-6 text-ink">{draft.draftText}</p>

                {draft.sourceExcerpts.length ? (
                  <details className="group mt-3">
                    <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-extrabold text-subtle hover:text-ink">
                      <Quote size={13} />
                      Source excerpts ({draft.sourceExcerpts.length})
                      <ChevronDown size={13} className="transition-transform group-open:rotate-180" />
                    </summary>
                    <ul className="mt-2 space-y-1 border-l border-line pl-3 text-xs leading-5 text-muted">
                      {draft.sourceExcerpts.map((excerpt) => (
                        <li key={excerpt}>{excerpt}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}

                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => act(draft.id, "approve")}
                    disabled={busy === draft.id}
                  >
                    <Check size={14} />
                    Approve
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => act(draft.id, "reject")}
                    disabled={busy === draft.id}
                  >
                    <X size={14} />
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
