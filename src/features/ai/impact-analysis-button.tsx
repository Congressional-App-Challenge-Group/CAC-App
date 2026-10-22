/**
 * Impact Analysis Button - Client component to fetch and display impact analysis
 */

"use client";

import { useState } from "react";
import { History, Loader2 } from "lucide-react";
import { ImpactAnalysisViewer } from "./impact-analysis";

interface ImpactAnalysisButtonProps {
  decisionId: string;
  variant?: "default" | "secondary";
}

export function ImpactAnalysisButton({ decisionId, variant = "default" }: ImpactAnalysisButtonProps) {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch("/api/ai/impact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error("Failed to generate impact analysis");
      }

      const data = await response.json();
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (analysis) {
    return <ImpactAnalysisViewer analysis={analysis} />;
  }

  return (
    <div>
      <button
        onClick={handleAnalyze}
        disabled={loading}
        className={variant === "secondary"
          ? "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold bg-surface-3 text-ink hover:bg-surface-4 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          : "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium bg-civic/10 text-civic hover:bg-civic/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        }
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Analyzing historical patterns...
          </>
        ) : (
          <>
            <History size={16} />
            {variant === "secondary" ? "History" : "Analyze historical impact"}
          </>
        )}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
);
}
