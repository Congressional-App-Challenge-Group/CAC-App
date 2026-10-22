/**
 * API Route: Decision Comparison
 *
 * POST /api/ai/compare
 *
 * Compares two decisions side-by-side based on their verified fields.
 * Requires:
 * - decisionIdA: First decision to compare
 * - decisionIdB: Second decision to compare
 *
 * Returns a ComparisonResult with field-by-field comparison and similarity score.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDecision, getDecisions } from "@/server/decisions";
import { compareDecisions, findSimilarDecisions } from "@/lib/decision-comparer";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { decisionIdA, decisionIdB, findSimilar } = body;

    // Validate required fields
    if (!decisionIdA || !decisionIdB) {
      return NextResponse.json(
        { error: "Both decisionIdA and decisionIdB are required" },
        { status: 400 }
      );
    }

    // Get both decisions
    const [decisionA, decisionB] = await Promise.all([
      getDecision(decisionIdA),
      getDecision(decisionIdB),
    ]);

    // If decisions not found, return sample data for demo
    if (!decisionA || !decisionB) {
      console.log("[API] Decisions not found, returning sample comparison");
      return NextResponse.json({
        comparison: {
          decisionA: {
            id: decisionIdA || "demo-1",
            slug: "demo-decision-1",
            title: "Sample Decision A (Demo)",
            organization: "charlotte",
          },
          decisionB: {
            id: decisionIdB || "demo-2",
            slug: "demo-decision-2",
            title: "Sample Decision B (Demo)",
            organization: "charlotte",
          },
          fields: [
            { field: "Status", label: "Status", valueA: "Under review", valueB: "Approved", different: true },
            { field: "Organization", label: "Organization", valueA: "charlotte", valueB: "charlotte", different: false },
            { field: "Topic", label: "Topic", valueA: "housing", valueB: "housing", different: false },
            { field: "ZIP Code", label: "Location", valueA: "28202", valueB: "28203", different: true },
          ],
          summary: "This is a sample comparison for demo purposes. In production, this would compare actual decisions from the database.",
          similarityScore: 0.5,
        },
      });
    }

    // Generate comparison
    const comparison = compareDecisions(decisionA, decisionB);

    // If requested, find similar decisions to both
    if (findSimilar) {
      try {
        const allDecisions = await getDecisions({ withRelations: true, limit: 1000 });
        const similarToA = findSimilarDecisions(decisionA, allDecisions, 3);
        const similarToB = findSimilarDecisions(decisionB, allDecisions, 3);

        return NextResponse.json({
          comparison,
          similarToA: similarToA.map((s) => ({
            id: s.decision.id,
            slug: s.decision.slug,
            title: s.decision.title,
            similarityScore: s.similarityScore,
          })),
          similarToB: similarToB.map((s) => ({
            id: s.decision.id,
            slug: s.decision.slug,
            title: s.decision.title,
            similarityScore: s.similarityScore,
          })),
        });
      } catch (error) {
        console.error("[API] Failed to find similar decisions:", error);
        // Return comparison without similar decisions
        return NextResponse.json({ comparison });
      }
    }

    return NextResponse.json({ comparison });
  } catch (error) {
    console.error("[API] Decision comparison error:", error);
    return NextResponse.json(
      { error: "Failed to compare decisions" },
      { status: 500 }
    );
  }
}
