/**
 * AI Features Demo Page
 *
 * Demonstrates the three new AI-powered features:
 * 1. Document Summarization
 * 2. Decision Comparison
 * 3. Impact Analysis
 *
 * This is a demo page with sample data to show the UI components.
 * In production, these would be integrated into decision detail pages.
 */

import { DocumentSummaryViewer } from "@/features/ai/document-summary";
import { DecisionComparisonViewer } from "@/features/ai/decision-comparison";
import { ImpactAnalysisViewer } from "@/features/ai/impact-analysis";

// Sample data for demo purposes
const sampleSummary = {
  executiveSummary: "This rezoning petition proposes changing the zoning from R-3 multifamily to B-2 neighborhood business for a 2.5-acre parcel at 123 Main Street. The development would include a mixed-use building with retail on the ground floor and residential units above. The petitioner estimates the project will create 45 new housing units and 20 permanent jobs.",
  keyPoints: [
    "Zoning change from R-3 multifamily to B-2 neighborhood business",
    "2.5-acre parcel at 123 Main Street in Uptown Charlotte",
    "Mixed-use development: retail ground floor, residential above",
    "45 new housing units proposed",
    "20 permanent jobs estimated",
    "Public hearing scheduled for November 15, 2026",
  ],
  keyFigures: [
    { label: "Total Cost", value: "$2.3M", context: "Total project development budget" },
    { label: "Housing Units", value: "45", context: "New residential units proposed" },
    { label: "Jobs Created", value: "20", context: "Permanent full-time positions" },
    { label: "Parcel Size", value: "2.5 acres", context: "Total land area for development" },
  ],
  keyDates: [
    { date: "2026-10-01", label: "Petition Filed" },
    { date: "2026-11-15", label: "Public Hearing" },
    { date: "2026-12-01", label: "City Council Vote" },
  ],
  sourceUrl: "https://charlottenc.gov/legistar/View.ashx?M=F&ID=12345",
  sourceTitle: "Rezoning Petition 2026-029 - City of Charlotte",
  requiresApproval: true,
  generatedAt: new Date().toISOString(),
};

const sampleComparison = {
  decisionA: {
    id: "1",
    slug: "rezoning-2026-029",
    title: "Rezoning Petition 2026-029 - 123 Main Street",
    organization: "charlotte",
  },
  decisionB: {
    id: "2",
    slug: "rezoning-2025-087",
    title: "Rezoning Petition 2025-087 - 456 Oak Avenue",
    organization: "charlotte",
  },
  fields: [
    { field: "Status", label: "Status", valueA: "Under review", valueB: "Approved", different: true },
    { field: "Organization", label: "Organization", valueA: "charlotte", valueB: "charlotte", different: false },
    { field: "Topic", label: "Topic", valueA: "housing", valueB: "housing", different: false },
    { field: "ZIP Code", label: "Location", valueA: "28202", valueB: "28203", different: true },
    { field: "Council District", label: "City Council District", valueA: "1", valueB: "2", different: true },
    { field: "County District", label: "County District", valueA: "1", valueB: "2", different: true },
    { field: "Cost", label: "Budget/Cost", valueA: "$2,300,000", valueB: "$5,000,000", different: true },
    { field: "Next Action Date", label: "Next Scheduled Action", valueA: "2026-12-01", valueB: "No date stated", different: true },
    { field: "Requester", label: "Requested by", valueA: "Rangeworks Development", valueB: "City Planning Department", different: true },
    { field: "Affected Groups", label: "Affected Roles", valueA: "Homeowner, Renter", valueB: "Business owner", different: true },
  ],
  summary: "Rezoning Petition 2026-029 and Rezoning Petition 2025-087 share 3 similarities and have 7 differences in the fields compared. These decisions have some similarities but also notable differences. Key differences include: Status, Location, City Council District, County District, Budget/Cost, Next Scheduled Action, Requester. Similarities include: Organization, Topic.",
  similarityScore: 0.5,
};

const sampleImpactAnalysis = {
  similarDecisions: [
    {
      id: "3",
      slug: "rezoning-2025-042",
      title: "Rezoning Petition 2025-042 - 789 Pine Street",
      status: "Approved",
      outcome: "Approved",
      similarityReason: "Very similar - same topic and organization",
    },
    {
      id: "4",
      slug: "rezoning-2025-091",
      title: "Rezoning Petition 2025-091 - 321 Elm Court",
      status: "Approved",
      outcome: "Approved",
      similarityReason: "Similar - shares key characteristics",
    },
    {
      id: "5",
      slug: "rezoning-2024-156",
      title: "Rezoning Petition 2024-156 - 654 Maple Drive",
      status: "Rejected",
      outcome: "Rejected",
      similarityReason: "Somewhat similar - some overlapping factors",
    },
  ],
  patterns: [
    "Found 3 similar historical decisions",
    "Similar decisions have statuses: Approved, Approved, Rejected",
    "Most similar decisions (2/3) were approved by City Council",
    "All similar decisions were from the same organization (charlotte)",
    "Similar decisions span multiple council districts (1, 2, 3)",
  ],
  historicalContext: "CivicLens found 3 similar decisions in the verified record set. These decisions have statuses: Approved, Approved, Rejected. Historically, rezoning petitions in Charlotte with similar characteristics (housing topic, mixed-use development) have a 67% approval rate (2 out of 3). The most recent similar decision (Rezoning 2025-091) was approved in February 2026. All similar decisions went through the public hearing process before a final council vote. For detailed analysis, please review the similar decisions directly.",
  caveat: "This analysis is based on historical patterns from the verified record set. Past outcomes do not guarantee future results. CivicLens does not predict how this decision will be resolved.",
  requiresApproval: true,
  generatedAt: new Date().toISOString(),
};

export default function AIDemoPage() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            AI Features Demo
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Demonstrating the three new AI-powered features for CivicLens
          </p>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-8">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Note:</strong> This is a demo page with sample data. In production, these features would be integrated into decision detail pages and use real decision data from the database.
          </p>
        </div>

        {/* Feature 1: Document Summarization */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
            1. Document Summarization
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">
            Summarizes long government documents with key points, figures, and dates.
            Saves citizens time while maintaining accuracy.
          </p>
          <DocumentSummaryViewer summary={sampleSummary} />
        </section>

        {/* Feature 2: Decision Comparison */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
            2. Decision Comparison
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">
            Side-by-side factual comparison of decisions to understand patterns,
            precedents, and differences.
          </p>
          <DecisionComparisonViewer comparison={sampleComparison} />
        </section>

        {/* Feature 3: Impact Analysis */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
            3. Impact Analysis
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">
            Historical pattern analysis from similar decisions. Shows what has
            happened before, not what will happen next.
          </p>
          <ImpactAnalysisViewer analysis={sampleImpactAnalysis} />
        </section>

        {/* Footer */}
        <div className="border-t border-neutral-200 dark:border-neutral-800 pt-8">
          <p className="text-sm text-neutral-500 dark:text-neutral-500">
            All AI features use Freebuff's free tier (30 hours/day, no credit card required).
            Generated content requires approval before public display.
          </p>
        </div>
      </div>
    </div>
  );
}
