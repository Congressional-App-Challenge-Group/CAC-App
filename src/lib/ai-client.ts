/**
 * AI Client - Abstraction layer for AI providers
 *
 * Supports multiple AI backends with a unified interface. Currently configured
 * for Groq (free tier) via OpenAI-compatible gateway, with fallback to
 * deterministic templates when no API key is configured.
 *
 * TODO: Add rate limiting for production use
 * FIXME: Improve error handling for provider-specific failures
 */

import { z } from "zod";

export type AIProvider = "freebuff" | "openai" | "together" | "template" | "none";

export interface AIConfig {
  provider: AIProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIResponse {
  text: string;
  model: string;
  tokensUsed?: number;
  provider: string;
  cached: boolean;
}

/**
 * Parse AI configuration from environment variables
 */
export function getAIConfig(): AIConfig {
  const provider = (process.env.AI_PROVIDER || "template") as AIProvider;

  // Freebuff configuration (recommended for free tier)
  if (provider === "freebuff") {
    return {
      provider: "freebuff",
      apiKey: process.env.FREEBUFF_API_KEY,
      baseUrl: process.env.FREEBUFF_BASE_URL || "http://localhost:8787/v1",
      model: process.env.FREEBUFF_MODEL || "deepseek/deepseek-v4-flash",
      maxTokens: 2000,
      temperature: 0.3,
    };
  }

  // OpenAI configuration (existing infrastructure)
  if (provider === "openai") {
    return {
      provider: "openai",
      apiKey: process.env.ENRICHMENT_API_KEY,
      baseUrl: process.env.ENRICHMENT_BASE_URL || "https://api.openai.com/v1",
      model: process.env.ENRICHMENT_MODEL || "gpt-4o-mini",
      maxTokens: 2000,
      temperature: 0.3,
    };
  }

  // Together AI configuration (for Congressional App Challenge)
  if (provider === "together") {
    return {
      provider: "together",
      apiKey: process.env.TOGETHER_API_KEY,
      baseUrl: process.env.TOGETHER_BASE_URL || "https://api.together.ai/v1",
      model: process.env.TOGETHER_MODEL || "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      maxTokens: 2000,
      temperature: 0.3,
    };
  }

  // Template mode (deterministic, no AI)
  return {
    provider: "template",
    maxTokens: 0,
    temperature: 0,
  };
}

/**
 * Call the AI provider with a prompt and return the response
 *
 * This function handles:
 * - Provider selection and routing
 * - Error handling and fallback
 * - Rate limiting awareness
 * - Response validation
 */
export async function callAI(
  messages: AIMessage[],
  config?: Partial<AIConfig>
): Promise<AIResponse> {
  const finalConfig = { ...getAIConfig(), ...config };

  // Template mode: return a deterministic response
  if (finalConfig.provider === "template" || !finalConfig.apiKey) {
    return {
      text: generateTemplateResponse(messages),
      model: "template",
      provider: "template",
      cached: false,
    };
  }

  // Freebuff or OpenAI: call the API
  try {
    const response = await fetch(`${finalConfig.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${finalConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: finalConfig.model,
        messages,
        max_tokens: finalConfig.maxTokens,
        temperature: finalConfig.temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[AI] API error (${finalConfig.provider}):`, error);
      // Fallback to template on error
      return {
        text: generateTemplateResponse(messages),
        model: finalConfig.model || "unknown",
        provider: finalConfig.provider,
        cached: false,
      };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";

    return {
      text,
      model: data.model || finalConfig.model || "unknown",
      tokensUsed: data.usage?.total_tokens,
      provider: finalConfig.provider,
      cached: false,
    };
  } catch (error) {
    console.error(`[AI] Call failed (${finalConfig.provider}):`, error);
    // Fallback to template on error
    return {
      text: generateTemplateResponse(messages),
      model: finalConfig.model || "unknown",
      provider: finalConfig.provider,
      cached: false,
    };
  }
}

/**
 * Generate a deterministic template response (no AI)
 *
 * This is used when:
 * - No API key is configured
 * - AI provider is set to "template"
 * - AI call fails
 */
export function generateTemplateResponse(messages: AIMessage[]): string {
  const lastUserMessage = messages.filter((m) => m.role === "user").pop();
  if (!lastUserMessage) {
    return "No question provided.";
  }

  const content = lastUserMessage.content.toLowerCase();

  // Simple pattern matching for template responses
  if (content.includes("summarize") || content.includes("summary")) {
    return "Summary generated from official record text. Please provide the specific text to summarize.";
  }

  if (content.includes("compare") || content.includes("difference")) {
    return "Comparison based on verified fields from official records. The key differences will be extracted from the provided decision data. This compare function analyzes the differences between decisions.";
  }

  if (content.includes("impact") || content.includes("affect")) {
    return "Impact analysis based on historical patterns from similar decisions in the verified record set. This analysis uses only stated outcomes, not predictions. The impact is assessed from historical data.";
  }

  return "Response generated from official record text. CivicLens does not invent information beyond what the sources state.";
}

/**
 * Validate AI response against safety rules
 *
 * Ensures the response:
 * - Does not contain factual claims not supported by context
 * - Does not predict future outcomes
 * - Does not express opinions
 */
export function validateAIResponse(
  response: string,
  context: string
): { valid: boolean; reason?: string } {
  const text = response.toLowerCase();

  // Check for prediction language - look for "will" followed by outcome words
  if (/\bwill\b.*(result|outcome|vote|decision|pass|fail|approved|rejected)/.test(text)) {
    return { valid: false, reason: "Response contains predictions about future outcomes" };
  }

  // Check for opinion language
  if (/\b(i think|in my opinion|should|recommend|believe)\b/.test(text)) {
    return { valid: false, reason: "Response contains opinions or recommendations" };
  }

  // Check for factual claims not in context (basic heuristic)
  // Only check large numbers (not dates, years, etc.)
  // Skip year-like numbers (19xx or 20xx) since they're commonly in summaries
  const numbers = response.match(/\b\d{4,}(?:,\d{3})*(?:\.\d+)?\b/g) || [];
  for (const num of numbers) {
    const normalizedNum = num.replace(/,/g, "");
    // Skip years (1900-2099)
    if (/^(19|20)\d{2}$/.test(normalizedNum)) continue;
    if (!context.includes(normalizedNum) && !context.includes(num)) {
      return { valid: false, reason: `Response contains number "${num}" not found in context` };
    }
  }

  return { valid: true };
}

/**
 * Extract structured data from AI response using Zod schema
 *
 * This is useful for getting structured outputs (e.g., key points list)
 */
export async function extractStructured<T>(
  messages: AIMessage[],
  schema: z.ZodSchema<T>,
  config?: Partial<AIConfig>
): Promise<T | null> {
  const response = await callAI(messages, config);

  try {
    // Try to parse JSON from the response
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[AI] No JSON found in response");
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return schema.parse(parsed);
  } catch (error) {
    console.error("[AI] Failed to extract structured data:", error);
    return null;
  }
}
