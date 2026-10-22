/**
 * Document Summary Button - Client component to fetch and display summaries
 */

"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { DocumentSummaryViewer } from "./document-summary";

interface DocumentSummaryButtonProps {
  decisionId: string;
  sourceId: string;
  sourceTitle: string;
  variant?: "default" | "primary";
}

export function DocumentSummaryButton({
  decisionId,
  sourceId,
  sourceTitle,
  variant = "default",
}: DocumentSummaryButtonProps) {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSummarize = async () => {
    setLoading(true);
    setError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId, sourceId }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error("Failed to generate summary");
      }

      const data = await response.json();
      setSummary({
        ...data,
        sourceUrl: "#", // Would come from actual source
        sourceTitle,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (summary) {
    return <DocumentSummaryViewer summary={summary} />;
  }

  return (
    <button
      onClick={handleSummarize}
      disabled={loading}
      className={variant === "primary"
        ? "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold bg-civic text-white hover:bg-civic-strong disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        : "mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium bg-civic/10 text-civic hover:bg-civic/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      }
    >
      {loading ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          Generating summary...
        </>
      ) : (
        <>
          <FileText size={16} />
          {variant === "primary" ? "Summarize this decision" : "Summarize document"}
        </>
      )}
    </button>
  );
}
