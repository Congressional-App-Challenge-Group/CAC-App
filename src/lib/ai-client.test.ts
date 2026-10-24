/**
 * Tests for AI Client
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  getAIConfig,
  callAI,
  validateAIResponse,
  generateTemplateResponse,
} from "./ai-client";

describe("AI Client", () => {
  describe("getAIConfig", () => {
    it("returns template config when no provider is set", () => {
      const config = getAIConfig();
      assert.strictEqual(config.provider, "template");
      assert.strictEqual(config.maxTokens, 0);
      assert.strictEqual(config.temperature, 0);
    });

    it("returns openai config when provider is openai", () => {
      process.env.AI_PROVIDER = "openai";
      process.env.ENRICHMENT_API_KEY = "test-key";
      const config = getAIConfig();
      assert.strictEqual(config.provider, "openai");
      assert.strictEqual(config.apiKey, "test-key");
      assert.strictEqual(config.baseUrl, "https://api.openai.com/v1");
      delete process.env.AI_PROVIDER;
      delete process.env.ENRICHMENT_API_KEY;
    });

    it("returns freebuff config when provider is freebuff", () => {
      process.env.AI_PROVIDER = "freebuff";
      process.env.FREEBUFF_API_KEY = "test-key";
      const config = getAIConfig();
      assert.strictEqual(config.provider, "freebuff");
      assert.strictEqual(config.apiKey, "test-key");
      assert.strictEqual(config.baseUrl, "http://localhost:8787/v1");
      delete process.env.AI_PROVIDER;
      delete process.env.FREEBUFF_API_KEY;
    });
  });

  describe("generateTemplateResponse", () => {
    it("returns summary response for summarize question", () => {
      const messages = [{ role: "user" as const, content: "Summarize this document" }];
      const response = generateTemplateResponse(messages);
      assert.ok(response.includes("summarize"));
    });

    it("returns comparison response for compare question", () => {
      const messages = [{ role: "user" as const, content: "Compare these decisions" }];
      const response = generateTemplateResponse(messages);
      assert.ok(response.includes("compare"));
    });

    it("returns impact response for impact question", () => {
      const messages = [{ role: "user" as const, content: "What is the impact?" }];
      const response = generateTemplateResponse(messages);
      assert.ok(response.includes("impact"));
    });

    it("returns default response for unknown question", () => {
      const messages = [{ role: "user" as const, content: "Random question" }];
      const response = generateTemplateResponse(messages);
      assert.ok(response.includes("official record text"));
    });
  });

  describe("validateAIResponse", () => {
    it("accepts all responses for Congressional App Challenge demo", () => {
      const response = "Any response is accepted";
      const context = "Any context";
      const result = validateAIResponse(response, context);
      assert.strictEqual(result.valid, true);
    });
  });
});
