import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// We need to import the module under test after setting up env
const mockRegisterProvider = vi.fn();
const mockConsoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

function createMockPi(): ExtensionAPI {
	return {
		registerProvider: mockRegisterProvider,
	} as unknown as ExtensionAPI;
}

describe("alibaba-cloud extension", () => {
	beforeEach(() => {
		mockRegisterProvider.mockReset();
		mockConsoleWarn.mockClear();
	});

	describe("provider registration", () => {
		it("registers the alibaba-cloud provider with correct base config", async () => {
			process.env.DASHSCOPE_API_KEY = "sk-test-key";
			const { default: extension } = await import("./index");
			await extension(createMockPi());

			expect(mockRegisterProvider).toHaveBeenCalledTimes(1);
			expect(mockRegisterProvider).toHaveBeenCalledWith("alibaba-cloud", expect.objectContaining({
				name: "Alibaba Cloud",
				baseUrl: "https://coding-intl.dashscope.aliyuncs.com/v1",
				apiKey: "DASHSCOPE_API_KEY",
				authHeader: true,
				api: "openai-completions",
			}));
			delete process.env.DASHSCOPE_API_KEY;
		});

		it("warns when DASHSCOPE_API_KEY is not set", async () => {
			delete process.env.DASHSCOPE_API_KEY;
			const { default: extension } = await import("./index");
			await extension(createMockPi());

			expect(mockConsoleWarn).toHaveBeenCalledWith(
				expect.stringContaining("DASHSCOPE_API_KEY is not set"),
			);
		});

		it("does not warn when DASHSCOPE_API_KEY is set", async () => {
			process.env.DASHSCOPE_API_KEY = "sk-test-key";
			const { default: extension } = await import("./index");
			await extension(createMockPi());

			expect(mockConsoleWarn).not.toHaveBeenCalled();
			delete process.env.DASHSCOPE_API_KEY;
		});
	});

	describe("model data integrity", () => {
		async function getModels() {
			process.env.DASHSCOPE_API_KEY = "sk-test-key";
			const { default: extension } = await import("./index");
			await extension(createMockPi());
			const call = mockRegisterProvider.mock.calls[0];
			delete process.env.DASHSCOPE_API_KEY;
			return call[1].models;
		}

		it("registers all 6 active models", async () => {
			const models = await getModels();
			expect(models).toHaveLength(6);
		});

		it("has correct model IDs", async () => {
			const models = await getModels();
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

		it("all models have non-zero context windows and maxTokens", async () => {
			const models = await getModels();
			for (const model of models) {
				expect(model.contextWindow).toBeGreaterThan(0);
				expect(model.maxTokens).toBeGreaterThan(0);
			}
		});

		it("all models have zero cost", async () => {
			const models = await getModels();
			for (const model of models) {
				expect(model.cost).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
			}
		});

		it("all models have correct compat base settings", async () => {
			const models = await getModels();
			for (const model of models) {
				expect(model.compat).toBeDefined();
				expect(model.compat!.supportsDeveloperRole).toBe(false);
				expect(model.compat!.maxTokensField).toBe("max_tokens");
			}
		});

		it("Qwen models have thinkingFormat 'qwen'", async () => {
			const models = await getModels();
			const qwenModels = models.filter((m: { id: string }) => m.id.startsWith("qwen"));
			for (const model of qwenModels) {
				expect(model.compat!.thinkingFormat).toBe("qwen");
			}
		});

		it("non-Qwen reasoning models have thinkingFormat 'openai'", async () => {
			const models = await getModels();
			const nonQwenReasoning = models.filter(
				(m: { id: string; reasoning: boolean }) => !m.id.startsWith("qwen") && m.reasoning,
			);
			for (const model of nonQwenReasoning) {
				expect(model.compat!.thinkingFormat).toBe("openai");
			}
		});

		it("multimodal models (qwen, glm) have input ['text', 'image']", async () => {
			const models = await getModels();
			const multimodalIds = ["qwen3.6-plus", "qwen3.5-plus", "glm-5", "glm-4.7"];
			const multimodalModels = models.filter((m: { id: string }) => multimodalIds.includes(m.id));
			for (const model of multimodalModels) {
				expect(model.input).toEqual(expect.arrayContaining(["text", "image"]));
			}
		});

		it("text-only models (kimi, MiniMax) have input ['text']", async () => {
			const models = await getModels();
			const textOnlyIds = ["kimi-k2.5", "MiniMax-M2.5"];
			const textOnlyModels = models.filter((m: { id: string }) => textOnlyIds.includes(m.id));
			for (const model of textOnlyModels) {
				expect(model.input).toEqual(["text"]);
			}
		});

		it("all models are marked as reasoning-capable", async () => {
			const models = await getModels();
			for (const model of models) {
				expect(model.reasoning).toBe(true);
			}
		});

		it("no model has thinkingFormat outside the valid union", async () => {
			const validFormats = ["openai", "openrouter", "deepseek", "zai", "qwen", "qwen-chat-template"];
			const models = await getModels();
			for (const model of models) {
				if (model.compat?.thinkingFormat) {
					expect(validFormats).toContain(model.compat.thinkingFormat);
				}
			}
		});
	});
});
