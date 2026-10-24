/**
 * Impact Analyzer - Analyze historical patterns from similar decisions
 *
 * This module analyzes how similar decisions have played out in the past to
 * provide context for current decisions.
 *
 * NOTE: This is NOT a prediction tool - it shows what has happened before,
 * not what will happen next.
 * TODO: Improve similarity matching for better historical context
 */

import { callAI, type AIMessage } from "./ai-client";
import type { Decision } from "@/types";

export interface ImpactAnalysis {
  decisionId: string;
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
  generatedAt: string;
  model: string;
  requiresApproval: boolean;
}

export interface ImpactAnalysisRequest {
  decision: Decision;
  allDecisions: Decision[];
  maxSimilarDecisions?: number;
}

/**
 * Analyze the potential impact of a decision based on historical patterns
 *
 * This:
 * 1. Finds similar historical decisions
 * 2. Extracts patterns from those decisions
 * 3. Provides context about what has happened before
 * 4. Clearly states that this is analysis, not prediction
 */
export async function analyzeImpact(
  request: ImpactAnalysisRequest
): Promise<ImpactAnalysis> {
  const { decision, allDecisions, maxSimilarDecisions = 5 } = request;

  // Find similar decisions
  const similarDecisions = findSimilarDecisions(decision, allDecisions, maxSimilarDecisions);

  // If no similar decisions, return a safe response
  if (similarDecisions.length === 0) {
    return {
      decisionId: decision.id,
      similarDecisions: [],
      patterns: ["No similar historical decisions found in the verified record set"],
      historicalContext: `CivicLens found no similar decisions in the verified record set to provide historical context for ${decision.title}. This may be because the decision is novel or because the current record set does not contain comparable cases.`,
      caveat: "This analysis is based on the current verified record set only. The absence of similar decisions does not mean this type of decision has never occurred - it may simply not be in the current dataset.",
      generatedAt: new Date().toISOString(),
      model: "none",
      requiresApproval: false,
    };
  }

  // Build context for AI analysis
  const context = buildContextForAnalysis(decision, similarDecisions);

  const systemPrompt: AIMessage = {
    role: "system",
    content: `You are a civic impact analyzer for CivicLens. Your task is to analyze historical patterns from similar government decisions to provide context.

CRITICAL RULES:
1. Only use information from the provided decision data
2. Do NOT predict future outcomes - this is historical analysis only
3. Do NOT express opinions about what should happen
4. Clearly state that you are analyzing what HAS happened, not what WILL happen
5. Identify patterns in status, timeline, geographic distribution, and outcomes
6. If information is not in the data, state that it is not available
7. Always include a caveat that past patterns do not guarantee future results

Format your response as JSON with this structure:
{
  "patterns": ["pattern 1", "pattern 2", "pattern 3"],
  "historicalContext": "2-3 paragraph analysis of what the historical data shows"
}

Keep the historicalContext neutral and factual. Use phrases like "Historically," "In similar cases," "The record set shows," and avoid "will," "likely to," "expected to."`,
  };

  const userPrompt: AIMessage = {
    role: "user",
    content: `Analyze the historical patterns for this decision:

Current decision:
Title: ${decision.title}
Organization: ${decision.organization}
Topic: ${decision.topic}
Status: ${decision.status}
Location: ${decision.geography?.zipCode || "Not confirmed"}
Cost: ${decision.money?.amountUsd ? `$${decision.money.amountUsd.toLocaleString()}` : "Not stated"}

Similar historical decisions:
${context}

Analyze the patterns and provide historical context. Remember: this is about what HAS happened, not what WILL happen.`,
  };

  const response = await callAI([systemPrompt, userPrompt]);

  // Parse the JSON response
  try {
    // Try to extract JSON from the response (sometimes AI adds extra text)
    let jsonText = response.text;
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[Impact Analyzer] No JSON found in response");
      return createFallbackAnalysis(request, similarDecisions, "No JSON in AI response");
    }

    jsonText = jsonMatch[0];

    // Fix common JSON issues: trailing commas, unquoted keys, etc.
    jsonText = jsonText
      .replace(/,\s*}/g, '}')  // Remove trailing commas
      .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
      .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');  // Quote unquoted keys

    const parsed = JSON.parse(jsonText);
    return {
      decisionId: decision.id,
      similarDecisions: similarDecisions.map((d) => ({
        id: d.decision.id,
        slug: d.decision.slug,
        title: d.decision.title,
        status: d.decision.status,
        outcome: d.decision.status,
        similarityReason: getSimilarityReason(d.similarityScore),
      })),
      patterns: parsed.patterns || [],
      historicalContext: parsed.historicalContext || "",
      caveat: "This analysis is based on historical patterns from the verified record set. Past outcomes do not guarantee future results. CivicLens does not predict how this decision will be resolved.",
      generatedAt: new Date().toISOString(),
      model: response.model,
      requiresApproval: true, // AI-generated content requires approval
    };
  } catch (error) {
    console.error("[Impact Analyzer] Failed to parse JSON:", error);
    console.error("[Impact Analyzer] Response text:", response.text);
    return createFallbackAnalysis(request, similarDecisions, "Failed to parse AI response");
  }
}

/**
 * Find similar decisions for impact analysis
 */
function findSimilarDecisions(
  decision: Decision,
  allDecisions: Decision[],
  limit: number
): Array<{ decision: Decision; similarityScore: number }> {
  const similarities = allDecisions
    .filter((d) => d.id !== decision.id && d.isPublished)
    .map((d) => ({
      decision: d,
      similarityScore: calculateSimilarity(decision, d),
    }))
    .filter((s) => s.similarityScore > 0.3) // Only include reasonably similar decisions
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, limit);

  return similarities;
}

/**
 * Calculate similarity score for impact analysis
 *
 * Uses a weighted scoring system focusing on factors that might indicate
 * similar outcomes: topic, organization, location, and cost range.
 */
function calculateSimilarity(decisionA: Decision, decisionB: Decision): number {
  let score = 0;

  // Topic match (highest weight)
  if (decisionA.topic.toLowerCase() === decisionB.topic.toLowerCase()) score += 0.4;

  // Organization match
  if (decisionA.organization === decisionB.organization) score += 0.2;

  // Geographic proximity
  const geoA = decisionA.geography;
  const geoB = decisionB.geography;
  if (geoA?.zipCode && geoB?.zipCode && geoA.zipCode === geoB.zipCode) score += 0.2;
  if (geoA?.councilDistrict && geoB?.councilDistrict && geoA.councilDistrict === geoB.councilDistrict) score += 0.1;

  // Cost range similarity (if both have costs)
  const costA = decisionA.money?.amountUsd;
  const costB = decisionB.money?.amountUsd;
  if (costA && costB) {
    const ratio = Math.min(costA, costB) / Math.max(costA, costB);
    if (ratio > 0.5) score += 0.1; // Similar cost range
  }

  return score;
}

/**
 * Build context string for AI analysis
 */
function buildContextForAnalysis(
  decision: Decision,
  similarDecisions: Array<{ decision: Decision; similarityScore: number }>
): string {
  return similarDecisions
    .map(
      (s, i) => `${i + 1}. ${s.decision.title}
   Status: ${s.decision.status}
   Organization: ${s.decision.organization}
   Topic: ${s.decision.topic}
   Location: ${s.decision.geography?.zipCode || "Not confirmed"}
   Cost: ${s.decision.money?.amountUsd ? `$${s.decision.money.amountUsd.toLocaleString()}` : "Not stated"}
   Approved at: ${s.decision.approvedAt || "Not approved yet"}
   Similarity score: ${s.similarityScore.toFixed(2)}`
    )
    .join("\n\n");
}

/**
 * Get a human-readable reason for similarity
 */
function getSimilarityReason(score: number): string {
  if (score > 0.7) return "Very similar - same topic and organization";
  if (score > 0.5) return "Similar - shares key characteristics";
  if (score > 0.4) return "Somewhat similar - some overlapping factors";
  return "Loosely similar - limited common factors";
}

/**
 * Create a safe fallback analysis when AI fails
 */
function createFallbackAnalysis(
  request: ImpactAnalysisRequest,
  similarDecisions: Array<{ decision: Decision; similarityScore: number }>,
  reason: string
): ImpactAnalysis {
  const { decision } = request;

  const patterns = similarDecisions.length > 0
    ? [
        `Found ${similarDecisions.length} similar historical decisions`,
        `Similar decisions have statuses: ${[...new Set(similarDecisions.map((s) => s.decision.status))].join(", ")}`,
      ]
    : ["No similar historical decisions found"];

  const historicalContext = similarDecisions.length > 0
    ? `AI analysis unavailable (${reason}). CivicLens found ${similarDecisions.length} similar decisions in the verified record set. These decisions have statuses: ${[...new Set(similarDecisions.map((s) => s.decision.status))].join(", ")}. For detailed analysis, please review the similar decisions directly.`
    : `AI analysis unavailable (${reason}). CivicLens found no similar decisions in the verified record set for ${decision.title}.`;

  return {
    decisionId: decision.id,
    similarDecisions: similarDecisions.map((d) => ({
      id: d.decision.id,
      slug: d.decision.slug,
      title: d.decision.title,
      status: d.decision.status,
      outcome: d.decision.status,
      similarityReason: getSimilarityReason(d.similarityScore),
    })),
    patterns,
    historicalContext,
    caveat: "This analysis is based on historical patterns from the verified record set. Past outcomes do not guarantee future results.",
    generatedAt: new Date().toISOString(),
    model: "fallback",
    requiresApproval: false,
  };
}

/**
 * Get impact analysis for a decision (with caching)
 *
 * In production, this would check a database table for cached analyses
 */
export async function getImpactAnalysis(decisionId: string): Promise<ImpactAnalysis | null> {
  // TODO: Implement database query
  // For now, return null (no cached analysis)
  return null;
}
