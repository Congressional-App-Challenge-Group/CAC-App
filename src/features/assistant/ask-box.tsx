"use client";
import { useState } from "react";
import { Bot, ExternalLink, Send, Sparkles } from "lucide-react";
import type { CivicAssistantAnswer, Decision } from "@/types";

const suggestions = ["Has this been approved?", "What changed most recently?", "Who could be affected?", "What happens next?", "Is a cost listed?"];

export function AskBox({ decision }: { decision?: Decision }) {
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
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-[#e2ebe7] bg-[#f4f8f6] px-5 py-4">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#102a26] text-emerald-300"><Bot size={20} /></span>
        <div className="flex-1">
          <h2 className="font-black tracking-[-.02em]">Ask CivicLens</h2>
          <p className="text-xs text-[#6b7d78]">Answers are grounded in indexed official records</p>
        </div>
        <Sparkles size={18} className="text-[#08785f]" />
      </div>
      <div className="p-5">
        <div className="flex flex-wrap gap-2">
          {suggestions.slice(0, decision ? 5 : 3).map((s) => (
            <button className="chip text-left" onClick={() => ask(s)} key={s}>{s}</button>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <label className="flex-1">
            <span className="sr-only">Your question</span>
            <input className="field h-12" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} placeholder="Ask a question about this decision…" />
          </label>
          <button className="btn btn-primary h-12 w-12 p-0" onClick={() => ask()} disabled={busy} aria-label="Send question"><Send size={18} /></button>
        </div>
        {busy && <p className="mt-4 animate-pulse text-sm font-bold text-[#08785f]">Checking indexed records…</p>}
        {error && <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800" role="alert">{error}</p>}
        {answer && (
          <div className="mt-5 rounded-2xl border border-[#cee2da] bg-[#edf6f2] p-4" aria-live="polite">
            <p className="leading-7 text-[#29443d]">{answer.text}</p>
            {answer.citations.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2 border-t border-[#d4e6df] pt-3">
                {answer.citations.map((citation, index) => (
                  <li key={`${citation.url}-${index}`}>
                    <a className="inline-flex items-center gap-1.5 rounded-full border border-[#bcd6cb] bg-white px-3 py-1.5 text-xs font-extrabold text-[#08785f] hover:bg-[#e8f3ef]" href={citation.url} target="_blank" rel="noopener noreferrer">
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