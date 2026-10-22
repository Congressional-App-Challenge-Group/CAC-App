/**
 * API Route: Document Summarization
 *
 * POST /api/ai/summarize
 *
 * Summarizes a document source for a decision. Requires:
 * - decisionId: The decision to summarize
 * - sourceId: The specific source to summarize
 * - documentText: (optional) The document text to summarize
 *
 * Returns a DocumentSummary with key points, figures, dates, and executive summary.
 * All summaries require approval before public display.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDecision, getDecisions } from "@/server/decisions";
import { summarizeDocument } from "@/lib/document-summarizer";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { decisionId, sourceId, documentText } = body;

    // Validate required fields
    if (!decisionId) {
      return NextResponse.json(
        { error: "decisionId is required" },
        { status: 400 }
      );
    }

    if (!sourceId) {
      return NextResponse.json(
        { error: "sourceId is required" },
        { status: 400 }
      );
    }

    // Get the decision
    const decision = await getDecision(decisionId);
    if (!decision) {
      return NextResponse.json({
        decisionId,
        sourceId,
        keyPoints: [
          "This is a sample summary for demo purposes",
          "In production, this would summarize actual document text",
          "Key points would be extracted from the source document",
        ],
        keyFigures: [
          { label: "Sample Figure", value: "$1M", context: "Sample context" },
        ],
        keyDates: [
          { date: "2026-12-01", label: "Sample date" },
        ],
        executiveSummary: "This is a sample executive summary for demo purposes. In production, this would be generated from the actual document text using AI.",
        generatedAt: new Date().toISOString(),
        model: "demo",
        requiresApproval: true,
      });
    }

    // Find the source
    const source = decision.sources.find((s) => s.id === sourceId);
    if (!source) {
      return NextResponse.json({
        decisionId,
        sourceId,
        keyPoints: [
          "This is a sample summary for demo purposes",
          "Source not found in decision",
        ],
        keyFigures: [],
        keyDates: [],
        executiveSummary: "Source not found in decision. This is a sample summary for demo purposes.",
        generatedAt: new Date().toISOString(),
        model: "demo",
        requiresApproval: true,
      });
    }

    // Generate the summary
    const summary = await summarizeDocument({
      decision,
      source,
      documentText,
    });

    return NextResponse.json(summary);
  } catch (error) {
    console.error("[API] Document summarization error:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}
