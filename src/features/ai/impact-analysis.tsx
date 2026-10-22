/**
 * Impact Analysis Viewer
 *
 * Displays historical pattern analysis with:
 * - Similar historical decisions
 * - Identified patterns
 * - Historical context
 * - Clear caveats about not being predictions
 * - Links to similar decisions
 */

"use client";

import { useState } from "react";
import { History, TrendingUp, AlertTriangle, CheckCircle, Clock } from "lucide-react";

export interface ImpactAnalysisProps {
  analysis: {
    similarDecisions: Array<{
      id: string;
      slug: string;
      title: string;
      status: string;
      outcome?: string;
      similarityReason: string;
    }>;
    patterns: string[];
    historicalContext: string;
    caveat: string;
    requiresApproval: boolean;
    generatedAt: string;
  };
}

export function ImpactAnalysisViewer({ analysis }: ImpactAnalysisProps) {
  const [expanded, setExpanded] = useState(false);

  const { similarDecisions, patterns, historicalContext, caveat, requiresApproval, generatedAt } = analysis;

  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
              Historical Pattern Analysis
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {requiresApproval ? (
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full">
                <Clock className="w-3 h-3" />
                Pending Review
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
                <CheckCircle className="w-3 h-3" />
                Approved
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Caveat Banner */}
      <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {caveat}
          </p>
        </div>
      </div>

      {/* Historical Context */}
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
        <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Historical Context
        </h4>
        <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
          {historicalContext}
        </p>
      </div>

      {/* Expandable Details */}
      {expanded && (
        <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {/* Patterns */}
          {patterns.length > 0 && (
            <div className="p-4">
              <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-3">
                Identified Patterns
              </h4>
              <ul className="space-y-2">
                {patterns.map((pattern, i) => (
                  <li key={i} className="text-sm text-neutral-700 dark:text-neutral-300 flex items-start gap-2">
                    <span className="text-blue-500 dark:text-blue-400 mt-1">•</span>
                    <span>{pattern}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Similar Decisions */}
          {similarDecisions.length > 0 && (
            <div className="p-4">
              <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-3">
                Similar Historical Decisions ({similarDecisions.length})
              </h4>
              <div className="space-y-3">
                {similarDecisions.map((decision, i) => (
                  <div
                    key={i}
                    className="border border-neutral-200 dark:border-neutral-800 rounded p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <a
                        href={`/decisions/${decision.slug}`}
                        className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {decision.title}
                      </a>
                      <span className="text-xs text-neutral-500 dark:text-neutral-500">
                        {decision.similarityReason}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-neutral-600 dark:text-neutral-400">
                      <span>Status: {decision.status}</span>
                      {decision.outcome && <span>·</span>}
                      {decision.outcome && <span>Outcome: {decision.outcome}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
        >
          {expanded ? "Show less" : "Show patterns and similar decisions"}
        </button>
        <span className="text-xs text-neutral-500 dark:text-neutral-500">
          Generated {new Date(generatedAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
