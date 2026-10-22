/**
 * Document Summary Viewer
 *
 * Displays AI-generated summaries of government documents with:
 * - Executive summary
 * - Key points
 * - Key figures with context
 * - Key dates
 * - Link to original source
 * - Approval status indicator
 */

"use client";

import { useState } from "react";
import { FileText, DollarSign, Calendar, CheckCircle, Clock, AlertCircle } from "lucide-react";

export interface DocumentSummaryProps {
  summary: {
    executiveSummary: string;
    keyPoints: string[];
    keyFigures: Array<{ label: string; value: string; context: string }>;
    keyDates: Array<{ date: string; label: string }>;
    sourceUrl: string;
    sourceTitle: string;
    requiresApproval: boolean;
    generatedAt: string;
  };
}

export function DocumentSummaryViewer({ summary }: DocumentSummaryProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 bg-white dark:bg-neutral-900">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
            Document Summary
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {summary.requiresApproval ? (
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

      {/* Executive Summary */}
      <div className="mb-4">
        <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
          {summary.executiveSummary}
        </p>
      </div>

      {/* Expandable Details */}
      {expanded && (
        <div className="space-y-4 mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
          {/* Key Points */}
          {summary.keyPoints.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                Key Points
              </h4>
              <ul className="space-y-1">
                {summary.keyPoints.map((point, i) => (
                  <li key={i} className="text-sm text-neutral-700 dark:text-neutral-300 flex items-start gap-2">
                    <span className="text-neutral-400 dark:text-neutral-600 mt-1">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Key Figures */}
          {summary.keyFigures.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Key Figures
              </h4>
              <div className="space-y-2">
                {summary.keyFigures.map((figure, i) => (
                  <div key={i} className="bg-neutral-50 dark:bg-neutral-800/50 rounded p-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {figure.value}
                      </span>
                      <span className="text-xs text-neutral-600 dark:text-neutral-400">
                        {figure.label}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                      {figure.context}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key Dates */}
          {summary.keyDates.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Key Dates
              </h4>
              <div className="space-y-1">
                {summary.keyDates.map((date, i) => (
                  <div key={i} className="text-sm text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                    <span className="font-medium">{date.date}</span>
                    <span className="text-neutral-400 dark:text-neutral-600">·</span>
                    <span>{date.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-800">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
        >
          {expanded ? "Show less" : "Show details"}
        </button>
        <a
          href={summary.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          View original source →
        </a>
      </div>

      {/* Timestamp */}
      <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-500">
        Generated {new Date(summary.generatedAt).toLocaleDateString()}
      </div>
    </div>
  );
}
