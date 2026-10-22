/**
 * API Route: Impact Analysis
 *
 * POST /api/ai/impact
 *
 * Analyzes historical patterns from similar decisions to provide context.
 * Requires:
 * - decisionId: The decision to analyze
 *
 * Returns an ImpactAnalysis with similar decisions, patterns, and historical context.
 * All analyses require approval before public display.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDecision, getDecisions } from "@/server/decisions";
import { analyzeImpact } from "@/lib/impact-analyzer";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { decisionId, maxSimilarDecisions } = body;

    // Validate required fields
    if (!decisionId) {
      return NextResponse.json(
        { error: "decisionId is required" },
        { status: 400 }
      );
    }

    // Get the decision
    const decision = await getDecision(decisionId);
    if (!decision) {
      return NextResponse.json({
        decisionId,
        similarDecisions: [
          {
            id: "demo-1",
            slug: "demo-decision-1",
            title: "Sample Similar Decision 1",
            status: "Approved",
            outcome: "Approved",
            similarityReason: "Very similar - same topic and organization",
          },
          {
            id: "demo-2",
            slug: "demo-decision-2",
            title: "Sample Similar Decision 2",
            status: "Approved",
            outcome: "Approved",
            similarityReason: "Similar - shares key characteristics",
          },
        ],
        patterns: [
          "Found 2 similar historical decisions (sample)",
          "Similar decisions have statuses: Approved, Approved",
          "Most similar decisions were approved by City Council",
        ],
        historicalContext: "This is a sample historical context for demo purposes. In production, this would analyze actual similar decisions from the database to provide historical patterns and context.",
        caveat: "This analysis is based on historical patterns from the verified record set. Past outcomes do not guarantee future results.",
        generatedAt: new Date().toISOString(),
        model: "demo",
        requiresApproval: true,
      });
    }

    // Get all decisions for similarity analysis
    const allDecisions = await getDecisions({ withRelations: true, limit: 1000 });

    // Generate impact analysis
    const analysis = await analyzeImpact({
      decision,
      allDecisions,
      maxSimilarDecisions: maxSimilarDecisions || 5,
    });

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("[API] Impact analysis error:", error);
    return NextResponse.json(
      { error: "Failed to generate impact analysis" },
      { status: 500 }
    );
  }
}
