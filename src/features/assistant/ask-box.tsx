"use client";
import { useState } from "react";
import { Bot, ExternalLink, Send, Sparkles } from "lucide-react";
import type { CivicAssistantAnswer, Decision } from "@/types";

const suggestions = ["Has this been approved?", "What changed most recently?", "Who could be affected?", "What happens next?"];
const crossSuggestions = ["What's scheduled for a vote this month?", "What rezonings are scheduled?", "What changed recently?", "What's happening with housing?"];

export function AskBox({ decision, compact }: { decision?: Decision; compact?: boolean }) {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<CivicAssistantAnswer | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(text = q) {
    const question = text.trim();
    if (!question) return;
    setQ(question);
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, decisionId: decision?.id }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as CivicAssistantAnswer | null;
        setAnswer(data ?? { text: "I could not answer that request right now.", citations: [] });
        return;
      }
      setAnswer((await response.json()) as CivicAssistantAnswer);
    } catch {
      setError("There was a network problem reaching CivicLens. Please try again.");
      setAnswer(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "" : "card overflow-hidden"}>
      {!compact && (
        <div className="flex items-center gap-3 border-b border-line bg-surface-2 px-5 py-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-civic"><Bot size={20} /></span>
          <div className="flex-1">
            <h2 className="font-black tracking-[-.02em]">Ask CivicLens</h2>
            <p className="text-xs text-subtle">Answers are grounded in indexed official records</p>
          </div>
          <Sparkles size={18} className="text-civic" />
        </div>
      )}
      <div className={compact ? "p-4" : "p-5"}>
        {!compact && (
          <div className="flex flex-wrap gap-2">
            {(decision ? suggestions : crossSuggestions).map((s) => (
              <button className="chip text-left" onClick={() => ask(s)} key={s}>{s}</button>
            ))}
          </div>
        )}
        <div className={compact ? "flex gap-2" : "mt-4 flex gap-2"}>
          <label className="flex-1">
            <span className="sr-only">Your question</span>
            <input 
              className="field" 
              style={{ height: compact ? "48px" : "48px" }}
              value={q} 
              onChange={(e) => setQ(e.target.value)} 
              onKeyDown={(e) => e.key === "Enter" && ask()} 
              placeholder={compact ? "Quick question..." : "Ask a question about this decision…"} 
            />
          </label>
          <button className="btn btn-primary p-0" style={{ width: compact ? "48px" : "48px", height: compact ? "48px" : "48px" }} onClick={() => ask()} disabled={busy} aria-label="Send question"><Send size={18} /></button>
        </div>
        {busy && <p className="mt-4 animate-pulse text-sm font-bold text-civic">Checking indexed records…</p>}
        {error && <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800" role="alert">{error}</p>}
        {answer && (
          <div className="mt-5 rounded-2xl border border-line-strong bg-surface-3 p-4" aria-live="polite">
            <p className="leading-7 text-ink-soft">{answer.text}</p>
            {answer.citations.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                {answer.citations.map((citation, index) => (
                  <li key={`${citation.url}-${index}`}>
                    <a className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-white px-3 py-1.5 text-xs font-extrabold text-civic hover:bg-surface-3" href={citation.url} target="_blank" rel="noopener noreferrer">
                      Source · {citation.title.slice(0, 60)} <ExternalLink size={12} />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
