/**
 * Decision Comparison - Compare similar decisions side-by-side
 *
 * This module provides factual, side-by-side comparisons of decisions based on
 * their verified fields.
 *
 * TODO: Add more comparison fields (cost, timeline, stakeholders)
 * FIXME: Improve similarity scoring algorithm for better matching
 */

import type { Decision } from "@/types";

export interface ComparisonField {
  field: string;
  label: string;
  valueA: string;
  valueB: string;
  different: boolean;
}

export interface ComparisonResult {
  decisionA: Pick<Decision, "id" | "slug" | "title" | "organization">;
  decisionB: Pick<Decision, "id" | "slug" | "title" | "organization">;
  fields: ComparisonField[];
  summary: string;
  similarityScore: number; // 0-1, higher = more similar
}

/**
 * Compare two decisions field-by-field
 *
 * This extracts and compares key fields to show similarities and differences.
 * All comparisons are factual and based on verified data.
 */
export function compareDecisions(decisionA: Decision, decisionB: Decision): ComparisonResult {
  const fields: ComparisonField[] = [];

  // Compare basic metadata
  fields.push(compareField("Status", "Status", decisionA.status, decisionB.status));
  fields.push(compareField("Organization", "Organization", decisionA.organization, decisionB.organization));
  fields.push(compareField("Topic", "Topic", decisionA.topic, decisionB.topic));

  // Compare geography
  const geoA = decisionA.geography;
  const geoB = decisionB.geography;
  fields.push(compareField("ZIP Code", "Location", geoA?.zipCode || "Not confirmed", geoB?.zipCode || "Not confirmed"));
  fields.push(compareField("Council District", "City Council District", geoA?.councilDistrict?.toString() || "Not confirmed", geoB?.councilDistrict?.toString() || "Not confirmed"));
  fields.push(compareField("County District", "County District", geoA?.countyDistrict?.toString() || "Not confirmed", geoB?.countyDistrict?.toString() || "Not confirmed"));

  // Compare money
  const moneyA = decisionA.money?.amountUsd;
  const moneyB = decisionB.money?.amountUsd;
  fields.push(compareField("Cost", "Budget/Cost", moneyA ? `$${moneyA.toLocaleString()}` : "Not stated", moneyB ? `$${moneyB.toLocaleString()}` : "Not stated"));

  // Compare deadlines
  const deadlineA = decisionA.deadline?.date;
  const deadlineB = decisionB.deadline?.date;
  fields.push(compareField("Next Action Date", "Next Scheduled Action", deadlineA || "No date stated", deadlineB || "No date stated"));

  // Compare requester
  fields.push(compareField("Requester", "Requested by", decisionA.requester || "Not stated", decisionB.requester || "Not stated"));

  // Compare affected groups
  const rolesA = decisionA.affectedRoles.join(", ") || "None identified";
  const rolesB = decisionB.affectedRoles.join(", ") || "None identified";
  fields.push(compareField("Affected Groups", "Affected Roles", rolesA, rolesB));

  // Calculate similarity score
  const differentCount = fields.filter((f) => f.different).length;
  const similarityScore = 1 - (differentCount / fields.length);

  // Generate summary
  const summary = generateComparisonSummary(decisionA, decisionB, fields, similarityScore);

  return {
    decisionA: {
      id: decisionA.id,
      slug: decisionA.slug,
      title: decisionA.title,
      organization: decisionA.organization,
    },
    decisionB: {
      id: decisionB.id,
      slug: decisionB.slug,
      title: decisionB.title,
      organization: decisionB.organization,
    },
    fields,
    summary,
    similarityScore,
  };
}

/**
 * Compare a single field between two decisions
 */
function compareField(
  field: string,
  label: string,
  valueA: string,
  valueB: string
): ComparisonField {
  const normalizedA = valueA.toLowerCase().trim();
  const normalizedB = valueB.toLowerCase().trim();
  const different = normalizedA !== normalizedB;

  return {
    field,
    label,
    valueA,
    valueB,
    different,
  };
}

/**
 * Generate a human-readable comparison summary
 */
function generateComparisonSummary(
  decisionA: Decision,
  decisionB: Decision,
  fields: ComparisonField[],
  similarityScore: number
): string {
  const differentFields = fields.filter((f) => f.different);
  const sameFields = fields.filter((f) => !f.different);

  let summary = `${decisionA.title} and ${decisionB.title} share ${sameFields.length} similarities and have ${differentFields.length} differences in the fields compared. `;

  if (similarityScore > 0.7) {
    summary += "These decisions are quite similar. ";
  } else if (similarityScore > 0.4) {
    summary += "These decisions have some similarities but also notable differences. ";
  } else {
    summary += "These decisions are quite different. ";
  }

  if (differentFields.length > 0) {
    summary += "Key differences include: ";
    summary += differentFields.slice(0, 3).map((f) => f.label).join(", ");
    if (differentFields.length > 3) {
      summary += `, and ${differentFields.length - 3} more`;
    }
    summary += ". ";
  }

  if (sameFields.length > 0) {
    summary += "Similarities include: ";
    summary += sameFields.slice(0, 3).map((f) => f.label).join(", ");
    if (sameFields.length > 3) {
      summary += `, and ${sameFields.length - 3} more`;
    }
  }

  return summary;
}

/**
 * Find similar decisions to a given decision
 *
 * This uses field-based similarity to find decisions that are similar to
 * the given decision. Useful for understanding precedents.
 */
export function findSimilarDecisions(
  decision: Decision,
  allDecisions: Decision[],
  limit: number = 5
): Array<{ decision: Decision; similarityScore: number }> {
  const similarities = allDecisions
    .filter((d) => d.id !== decision.id)
    .map((d) => ({
      decision: d,
      similarityScore: calculateSimilarity(decision, d),
    }))
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, limit);

  return similarities;
}

/**
 * Calculate similarity score between two decisions
 *
 * Uses a simple field-based similarity metric:
 * - Same topic: +0.3
 * - Same organization: +0.2
 * - Same status: +0.2
 * - Same ZIP code: +0.15
 * - Same council district: +0.15
 */
function calculateSimilarity(decisionA: Decision, decisionB: Decision): number {
  let score = 0;

  if (decisionA.topic.toLowerCase() === decisionB.topic.toLowerCase()) score += 0.3;
  if (decisionA.organization === decisionB.organization) score += 0.2;
  if (decisionA.status === decisionB.status) score += 0.2;

  const geoA = decisionA.geography;
  const geoB = decisionB.geography;
  if (geoA?.zipCode && geoB?.zipCode && geoA.zipCode === geoB.zipCode) score += 0.15;
  if (geoA?.councilDistrict && geoB?.councilDistrict && geoA.councilDistrict === geoB.councilDistrict) score += 0.15;

  return score;
}

/**
 * Compare multiple decisions at once
 *
 * Useful for understanding patterns across a set of decisions
 */
export function compareMultipleDecisions(decisions: Decision[]): {
  comparisons: ComparisonResult[];
  patterns: string[];
} {
  const comparisons: ComparisonResult[] = [];
  const patterns: string[] = [];

  // Compare each pair
  for (let i = 0; i < decisions.length; i++) {
    for (let j = i + 1; j < decisions.length; j++) {
      const comparison = compareDecisions(decisions[i], decisions[j]);
      comparisons.push(comparison);
    }
  }

  // Extract patterns
  if (decisions.length > 2) {
    // Check if most have the same organization
    const orgCounts = new Map<string, number>();
    decisions.forEach((d) => {
      orgCounts.set(d.organization, (orgCounts.get(d.organization) || 0) + 1);
    });
    const dominantOrg = [...orgCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (dominantOrg[1] > decisions.length / 2) {
      patterns.push(`Most decisions (${dominantOrg[1]}/${decisions.length}) are from ${dominantOrg[0]}`);
    }

    // Check if most have the same status
    const statusCounts = new Map<string, number>();
    decisions.forEach((d) => {
      statusCounts.set(d.status, (statusCounts.get(d.status) || 0) + 1);
    });
    const dominantStatus = [...statusCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (dominantStatus[1] > decisions.length / 2) {
      patterns.push(`Most decisions (${dominantStatus[1]}/${decisions.length}) have status "${dominantStatus[0]}"`);
    }

    // Check if most are in the same geographic area
    const zipCounts = new Map<string, number>();
    decisions.forEach((d) => {
      if (d.geography?.zipCode) {
        zipCounts.set(d.geography.zipCode, (zipCounts.get(d.geography.zipCode) || 0) + 1);
      }
    });
    const dominantZip = [...zipCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (dominantZip && dominantZip[1] > decisions.length / 2) {
      patterns.push(`Most decisions (${dominantZip[1]}/${decisions.length}) are in ZIP ${dominantZip[0]}`);
    }
  }

  return { comparisons, patterns };
}
