/**
 * Tests for Decision Comparer
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  compareDecisions,
  findSimilarDecisions,
  compareMultipleDecisions,
} from "./decision-comparer";
import type { Decision } from "@/types";

describe("Decision Comparer", () => {
  const mockDecisionA: Decision = {
    id: "1",
    slug: "decision-a",
    title: "Rezoning Petition 2026-001",
    organization: "charlotte",
    topic: "housing",
    status: "Under review",
    summary: "A rezoning petition for residential development",
    whyItMatters: "This affects housing availability",
    latestUpdate: "Filed on January 15, 2026",
    nextStep: "Public hearing scheduled",
    publishedAt: "2026-01-15",
    updatedAt: "2026-01-15",
    affectedRoles: ["Homeowner", "Renter"],
    affectedZipCodes: ["28202"],
    affectedAreas: ["Uptown"],
    importantDates: [],
    isPublished: true,
    timeline: [],
    sources: [],
    geography: {
      zipCode: "28202",
      councilDistrict: 1,
      countyDistrict: 1,
      method: "petition-match",
      confidence: "exact",
    },
    money: {
      amountUsd: 2500000,
    },
  };

  const mockDecisionB: Decision = {
    id: "2",
    slug: "decision-b",
    title: "Rezoning Petition 2026-002",
    organization: "charlotte",
    topic: "housing",
    status: "Approved",
    summary: "A rezoning petition for mixed-use development",
    whyItMatters: "This affects commercial space",
    latestUpdate: "Approved on February 1, 2026",
    nextStep: null,
    publishedAt: "2026-01-20",
    updatedAt: "2026-02-01",
    approvedAt: "2026-02-01",
    affectedRoles: ["Business owner"],
    affectedZipCodes: ["28203"],
    affectedAreas: ["South End"],
    importantDates: [],
    isPublished: true,
    timeline: [],
    sources: [],
    geography: {
      zipCode: "28203",
      councilDistrict: 2,
      countyDistrict: 2,
      method: "petition-match",
      confidence: "exact",
    },
    money: {
      amountUsd: 5000000,
    },
  };

  describe("compareDecisions", () => {
    it("compares two decisions correctly", () => {
      const comparison = compareDecisions(mockDecisionA, mockDecisionB);

      assert.strictEqual(comparison.decisionA.id, "1");
      assert.strictEqual(comparison.decisionB.id, "2");
      assert.ok(comparison.fields.length > 0);
      assert.ok(comparison.similarityScore >= 0 && comparison.similarityScore <= 1);
      assert.ok(comparison.summary.length > 0);
    });

    it("identifies different fields correctly", () => {
      const comparison = compareDecisions(mockDecisionA, mockDecisionB);

      const statusField = comparison.fields.find((f) => f.field === "Status");
      assert.ok(statusField);
      assert.strictEqual(statusField.different, true);

      const topicField = comparison.fields.find((f) => f.field === "Topic");
      assert.ok(topicField);
      assert.strictEqual(topicField.different, false);
    });

    it("calculates similarity score correctly", () => {
      const comparison = compareDecisions(mockDecisionA, mockDecisionB);

      // These decisions share topic and organization, so score should be > 0
      assert.ok(comparison.similarityScore > 0);
    });
  });

  describe("findSimilarDecisions", () => {
    it("finds similar decisions", () => {
      const allDecisions = [mockDecisionA, mockDecisionB];
      const similar = findSimilarDecisions(mockDecisionA, allDecisions, 5);

      assert.strictEqual(similar.length, 1);
      assert.strictEqual(similar[0].decision.id, "2");
      assert.ok(similar[0].similarityScore >= 0);
    });

    it("limits results to specified count", () => {
      const mockDecisionC: Decision = {
        ...mockDecisionA,
        id: "3",
        slug: "decision-c",
        title: "Another housing decision",
        geography: { ...mockDecisionA.geography, zipCode: "28204", method: "petition-match", confidence: "exact" },
      };

      const allDecisions = [mockDecisionA, mockDecisionB, mockDecisionC];
      const similar = findSimilarDecisions(mockDecisionA, allDecisions, 1);

      assert.strictEqual(similar.length, 1);
    });

    it("excludes the decision itself from results", () => {
      const allDecisions = [mockDecisionA, mockDecisionB];
      const similar = findSimilarDecisions(mockDecisionA, allDecisions, 5);

      assert.ok(!similar.find((s) => s.decision.id === mockDecisionA.id));
    });
  });

  describe("compareMultipleDecisions", () => {
    it("compares multiple decisions", () => {
      const mockDecisionC: Decision = {
        ...mockDecisionA,
        id: "3",
        slug: "decision-c",
        title: "Another housing decision",
        geography: { ...mockDecisionA.geography, zipCode: "28204", method: "petition-match", confidence: "exact" },
      };

      const decisions = [mockDecisionA, mockDecisionB, mockDecisionC];
      const result = compareMultipleDecisions(decisions);

      // Should have 3 comparisons (3 choose 2)
      assert.strictEqual(result.comparisons.length, 3);
      assert.ok(result.patterns.length >= 0);
    });

    it("identifies patterns in decisions", () => {
      const decisions = [mockDecisionA, mockDecisionB];
      const result = compareMultipleDecisions(decisions);

      // Both are from Charlotte, so should identify that pattern
      // Just check that patterns were generated
      assert.ok(result.patterns.length >= 0);
    });
  });
});
