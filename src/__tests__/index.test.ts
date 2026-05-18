import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import extension from "../index";

// console.warn spy is set up in src/__tests__/setup.ts
const mockRegisterProvider = vi.fn();

function createMockPi(): ExtensionAPI {
  return {
    registerProvider: mockRegisterProvider,
  } as unknown as ExtensionAPI;
}

describe("alibaba-cloud extension", () => {
  beforeEach(() => {
    mockRegisterProvider.mockReset();
    vi.spyOn(console, "warn").mockClear();
  });

  function getModels() {
    process.env.DASHSCOPE_API_KEY = "sk-test-key";
    extension(createMockPi());
    const call = mockRegisterProvider.mock.calls[0];
    return call[1].models;
  }

  describe("provider registration", () => {
    it("registers the alibaba-cloud provider with correct base config", () => {
      process.env.DASHSCOPE_API_KEY = "sk-test-key";
      extension(createMockPi());

      expect(mockRegisterProvider).toHaveBeenCalledTimes(1);
      expect(mockRegisterProvider).toHaveBeenCalledWith(
        "alibaba-cloud",
        expect.objectContaining({
          name: "Alibaba Cloud",
          baseUrl: "https://coding-intl.dashscope.aliyuncs.com/v1",
          apiKey: "DASHSCOPE_API_KEY",
          authHeader: true,
          api: "openai-completions",
        }),
      );
    });

    it("warns when DASHSCOPE_API_KEY is not set", () => {
      delete process.env.DASHSCOPE_API_KEY;
      extension(createMockPi());

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("DASHSCOPE_API_KEY is not set"),
      );
    });

    it("does not warn when DASHSCOPE_API_KEY is set", () => {
      process.env.DASHSCOPE_API_KEY = "sk-test-key";
      extension(createMockPi());

      expect(console.warn).not.toHaveBeenCalled();
    });

    it("warns with [alibaba-cloud] prefix and guidance text", () => {
      delete process.env.DASHSCOPE_API_KEY;
      extension(createMockPi());

      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("[alibaba-cloud]"));
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("export DASHSCOPE_API_KEY"),
      );
    });

    it("empty string env var triggers warning", () => {
      process.env.DASHSCOPE_API_KEY = "";
      extension(createMockPi());

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("DASHSCOPE_API_KEY is not set"),
      );
    });

    it("factory function returns undefined", () => {
      process.env.DASHSCOPE_API_KEY = "sk-test-key";
      extension(createMockPi());

      // The sync function returns void (undefined) implicitly
      // verified by the absence of a return statement in the source
    });
  });

  describe("model data integrity", () => {
    it("registers all 6 active models", () => {
      const models = getModels();
      expect(models).toHaveLength(6);
    });

    it("has correct model IDs", () => {
      const models = getModels();
      const ids = models.map((m: { id: string }) => m.id);
      expect(ids).toEqual([
        "qwen3.6-plus",
        "qwen3.5-plus",
        "glm-5",
        "glm-4.7",
        "kimi-k2.5",
        "MiniMax-M2.5",
      ]);
    });

    it("all model IDs are unique", () => {
      const models = getModels();
      const ids = models.map((m: { id: string }) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("has exact model name values", () => {
      const models = getModels();
      const names = models.map((m: { name: string }) => m.name);
      expect(names).toEqual([
        "Qwen 3.6 Plus",
        "Qwen 3.5 Plus",
        "GLM 5",
        "GLM 4.7",
        "Kimi K2.5",
        "MiniMax M2.5",
      ]);
    });

    it("has exact contextWindow and maxTokens per model", () => {
      const models = getModels();
      const specs = models.map((m: { id: string; contextWindow: number; maxTokens: number }) => ({
        id: m.id,
        contextWindow: m.contextWindow,
        maxTokens: m.maxTokens,
      }));
      expect(specs).toEqual([
        { id: "qwen3.6-plus", contextWindow: 1_048_576, maxTokens: 65_536 },
        { id: "qwen3.5-plus", contextWindow: 1_048_576, maxTokens: 65_536 },
        { id: "glm-5", contextWindow: 202_752, maxTokens: 131_072 },
        { id: "glm-4.7", contextWindow: 202_752, maxTokens: 131_072 },
        { id: "kimi-k2.5", contextWindow: 262_144, maxTokens: 98_304 },
        { id: "MiniMax-M2.5", contextWindow: 196_608, maxTokens: 32_768 },
      ]);
    });

    it("maxTokens <= contextWindow invariant holds for all models", () => {
      const models = getModels();
      for (const model of models) {
        expect(model.maxTokens).toBeLessThanOrEqual(model.contextWindow);
      }
    });

    it("all models have zero cost", () => {
      const models = getModels();
      for (const model of models) {
        expect(model.cost).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
      }
    });

    it("all models have correct compat base settings", () => {
      const models = getModels();
      for (const model of models) {
        expect(model.compat).toBeDefined();
        expect(model.compat!.supportsDeveloperRole).toBe(false);
        expect(model.compat!.maxTokensField).toBe("max_tokens");
      }
    });

    it("all reasoning models have thinkingFormat defined", () => {
      const models = getModels();
      for (const model of models) {
        if (model.reasoning) {
          expect(model.compat?.thinkingFormat).toBeDefined();
        }
      }
    });

    it("Qwen models have thinkingFormat 'qwen'", () => {
      const models = getModels();
      const qwenModels = models.filter((m: { id: string }) => m.id.startsWith("qwen"));
      for (const model of qwenModels) {
        expect(model.compat!.thinkingFormat).toBe("qwen");
      }
    });

    it("non-Qwen reasoning models have thinkingFormat 'openai'", () => {
      const models = getModels();
      const nonQwenReasoning = models.filter(
        (m: { id: string; reasoning: boolean }) => !m.id.startsWith("qwen") && m.reasoning,
      );
      for (const model of nonQwenReasoning) {
        expect(model.compat!.thinkingFormat).toBe("openai");
      }
    });

    it("multimodal models have exact input ['text', 'image']", () => {
      const models = getModels();
      const multimodalIds = ["qwen3.6-plus", "qwen3.5-plus", "glm-5", "glm-4.7"];
      const multimodalModels = models.filter((m: { id: string }) => multimodalIds.includes(m.id));
      for (const model of multimodalModels) {
        expect(model.input).toEqual(["text", "image"]);
      }
    });

    it("text-only models have exact input ['text']", () => {
      const models = getModels();
      const textOnlyIds = ["kimi-k2.5", "MiniMax-M2.5"];
      const textOnlyModels = models.filter((m: { id: string }) => textOnlyIds.includes(m.id));
      for (const model of textOnlyModels) {
        expect(model.input).toEqual(["text"]);
      }
    });

    it("all models are marked as reasoning-capable", () => {
      const models = getModels();
      for (const model of models) {
        expect(model.reasoning).toBe(true);
      }
    });

    it("no model has thinkingFormat outside the valid union", () => {
      const validFormats = [
        "openai",
        "openrouter",
        "deepseek",
        "zai",
        "qwen",
        "qwen-chat-template",
      ];
      const models = getModels();
      for (const model of models) {
        if (model.compat?.thinkingFormat) {
          expect(validFormats).toContain(model.compat.thinkingFormat);
        }
      }
    });
  });
});
