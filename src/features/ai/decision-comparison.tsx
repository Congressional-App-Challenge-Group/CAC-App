/**
 * Decision Comparison Viewer
 *
 * Displays side-by-side comparison of two decisions with:
 * - Similarity score
 * - Field-by-field comparison
 * - Visual indicators for differences
 * - Links to both decisions
 */

"use client";

import { useState } from "react";
import { ArrowRight, Check, X, Scale } from "lucide-react";

export interface DecisionComparisonProps {
  comparison: {
    decisionA: { id: string; slug: string; title: string; organization: string };
    decisionB: { id: string; slug: string; title: string; organization: string };
    fields: Array<{
      field: string;
      label: string;
      valueA: string;
      valueB: string;
      different: boolean;
    }>;
    summary: string;
    similarityScore: number;
  };
}

export function DecisionComparisonViewer({ comparison }: DecisionComparisonProps) {
  const [showAllFields, setShowAllFields] = useState(false);

  const { decisionA, decisionB, fields, summary, similarityScore } = comparison;

  // Show only different fields by default, or all if expanded
  const displayedFields = showAllFields
    ? fields
    : fields.filter((f) => f.different);

  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-2 mb-3">
          <Scale className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
            Decision Comparison
          </h3>
        </div>

        {/* Decision titles */}
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <a
              href={`/decisions/${decisionA.slug}`}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline block truncate"
            >
              {decisionA.title}
            </a>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              {decisionA.organization}
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-neutral-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <a
              href={`/decisions/${decisionB.slug}`}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline block truncate"
            >
              {decisionB.title}
            </a>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              {decisionB.organization}
            </p>
          </div>
        </div>
      </div>

      {/* Similarity Score */}
      <div className="px-4 py-3 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center justify-between">
          <span className="text-sm text-neutral-700 dark:text-neutral-300">
            Similarity Score
          </span>
          <div className="flex items-center gap-2">
            <div className="w-32 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 dark:bg-blue-400 transition-all"
                style={{ width: `${similarityScore * 100}%` }}
              />
            </div>
            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {(similarityScore * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          {summary}
        </p>
      </div>

      {/* Field Comparisons */}
      <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {displayedFields.map((field, i) => (
          <div key={i} className="px-4 py-3">
            <div className="text-xs font-medium text-neutral-500 dark:text-neutral-500 mb-2">
              {field.label}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-2">
                {field.different ? (
                  <X className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                )}
                <span
                  className={`text-sm ${
                    field.different
                      ? "text-neutral-900 dark:text-neutral-100 font-medium"
                      : "text-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  {field.valueA}
                </span>
              </div>
              <div className="flex items-start gap-2">
                {field.different ? (
                  <X className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                )}
                <span
                  className={`text-sm ${
                    field.different
                      ? "text-neutral-900 dark:text-neutral-100 font-medium"
                      : "text-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  {field.valueB}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Toggle Button */}
      {fields.length > displayedFields.length && (
        <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => setShowAllFields(!showAllFields)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            {showAllFields
              ? "Show only differences"
              : `Show all fields (${fields.length})`}
          </button>
        </div>
      )}
    </div>
  );
}
