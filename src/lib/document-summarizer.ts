/**
 * Document Summarizer - Summarize long documents for civic records
 *
 * Takes long government documents (PDFs, staff reports, meeting transcripts)
 * and extracts key points, figures, and timelines.
 *
 * TODO: Improve extraction accuracy for complex financial documents
 * NOTE: Summaries require approval before public display
 */

import { callAI, validateAIResponse, type AIMessage } from "./ai-client";
import type { Decision, CivicSource } from "@/types";

export interface DocumentSummary {
  decisionId: string;
  sourceId: string;
  keyPoints: string[];
  keyFigures: Array<{ label: string; value: string; context: string }>;
  keyDates: Array<{ date: string; label: string }>;
  executiveSummary: string;
  generatedAt: string;
  model: string;
  requiresApproval: boolean;
}

export interface SummarizationRequest {
  decision: Decision;
  source: CivicSource;
  documentText?: string;
  maxLength?: number;
}

/**
 * Generate a summary for a document source
 *
 * This extracts:
 * - Executive summary (3-5 sentences)
 * - Key points (bullet points)
 * - Key figures (with context)
 * - Key dates (with labels)
 */
export async function summarizeDocument(
  request: SummarizationRequest
): Promise<DocumentSummary> {
  const { decision, source, documentText, maxLength = 500 } = request;

  // If no document text provided, use the decision's existing content
  const content = documentText || (decision.summary || "") + " " + (decision.latestUpdate || "");

  const systemPrompt: AIMessage = {
    role: "system",
    content: `You are a civic document summarizer for CivicLens. Your task is to extract key information from government documents for public understanding.

CRITICAL RULES:
1. Only use information explicitly stated in the document text
2. Do not predict future outcomes or speculate
3. Do not express opinions or recommendations
4. Keep summaries factual and neutral
5. Extract all figures (numbers, dollar amounts, percentages) with their context
6. Extract all dates with their labels (e.g., "public hearing", "vote deadline")
7. If information is not in the document, state that it is not mentioned

Format your response as JSON with this structure:
{
  "executiveSummary": "3-5 sentence summary of the document",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "keyFigures": [{"label": "cost", "value": "$2.3M", "context": "total project budget"}],
  "keyDates": [{"date": "2026-11-15", "label": "City Council vote"}}

Keep the executive summary under ${maxLength} characters.`,
  };

  const userPrompt: AIMessage = {
    role: "user",
    content: `Summarize this government document:

Title: ${source.title}
Organization: ${source.organization}
Document URL: ${source.url}

Document text:
${content}

Extract the executive summary, key points, key figures, and key dates as specified in the system prompt.`,
  };

  const response = await callAI([systemPrompt, userPrompt]);

  // Validate the response
  const validation = validateAIResponse(response.text, content || "");
  if (!validation.valid) {
    console.error("[Document Summarizer] Validation failed:", validation.reason);
    // Return a safe fallback
    return createFallbackSummary(request, validation.reason || "Validation failed");
  }

  // Parse the JSON response
  try {
    const parsed = JSON.parse(response.text);
    return {
      decisionId: decision.id,
      sourceId: source.id,
      keyPoints: parsed.keyPoints || [],
      keyFigures: parsed.keyFigures || [],
      keyDates: parsed.keyDates || [],
      executiveSummary: parsed.executiveSummary || "",
      generatedAt: new Date().toISOString(),
      model: response.model,
      requiresApproval: true, // Always require approval for AI-generated content
    };
  } catch (error) {
    console.error("[Document Summarizer] Failed to parse JSON:", error);
    return createFallbackSummary(request, "Failed to parse AI response");
  }
}

/**
 * Create a safe fallback summary when AI fails
 */
function createFallbackSummary(
  request: SummarizationRequest,
  reason: string
): DocumentSummary {
  const { decision, source } = request;

  return {
    decisionId: decision.id,
    sourceId: source.id,
    keyPoints: [
      `Document title: ${source.title}`,
      `Organization: ${source.organization}`,
      `Decision status: ${decision.status}`,
    ],
    keyFigures: [],
    keyDates: decision.importantDates.map((d) => ({
      date: d.date,
      label: d.label,
    })),
    executiveSummary: `AI summarization unavailable (${reason}). This document is from ${source.organization} and relates to ${decision.title}. For the full details, please refer to the official source: ${source.url}`,
    generatedAt: new Date().toISOString(),
    model: "fallback",
    requiresApproval: false, // Fallback doesn't need approval
  };
}

/**
 * Batch summarize multiple documents
 *
 * Useful for processing all sources for a decision at once
 */
export async function summarizeDocumentsForDecision(
  decision: Decision
): Promise<DocumentSummary[]> {
  const summaries: DocumentSummary[] = [];

  for (const source of decision.sources) {
    try {
      const summary = await summarizeDocument({ decision, source });
      summaries.push(summary);
    } catch (error) {
      console.error(`[Document Summarizer] Failed to summarize source ${source.id}:`, error);
    }
  }

  return summaries;
}

/**
 * Check if a decision has summaries available
 */
export function hasDocumentSummaries(decision: Decision): boolean {
  // This would check a database table in production
  // For now, return false (no summaries yet)
  return false;
}

/**
 * Get approved summaries for a decision
 *
 * In production, this would query a database table for approved summaries
 */
export async function getApprovedSummaries(decisionId: string): Promise<DocumentSummary[]> {
  // TODO: Implement database query
  // For now, return empty array
  return [];
}
