import type { ExtensionAPI, ProviderModelConfig } from "@earendil-works/pi-coding-agent";

// =============================================================================
// Alibaba Cloud (DashScope) Provider Extension for pi-agent
//
// Registers models available on the Alibaba Cloud Coding Plan
// (coding-intl.dashscope.aliyuncs.com) as an OpenAI-compatible provider.
//
// Usage:
//   export DASHSCOPE_API_KEY=sk-...
//   pi
//
// Or copy to ~/.pi/agent/extensions/ for auto-discovery.
// =============================================================================

const BASE_URL = "https://coding-intl.dashscope.aliyuncs.com/v1";
const API_KEY_ENV = "DASHSCOPE_API_KEY";

/** Valid thinkingFormat values per the pi-coding-agent compat type. */
type ThinkingFormat = "openai" | "openrouter" | "deepseek" | "zai" | "qwen" | "qwen-chat-template";

/**
 * Models available on the Alibaba Cloud Coding Plan (coding-intl endpoint).
 * The coding-intl endpoint does not expose /v1/models, so this list is the
 * authoritative source. Keep it in sync with the Coding Plan dashboard.
 *
 * Context window and max output values sourced from:
 *   https://www.alibabacloud.com/help/en/model-studio/developer-reference/models
 */
const CODING_PLAN_MODELS: {
	id: string;
	name: string;
	reasoning: boolean;
	contextWindow: number;
	maxTokens: number;
	input: ("text" | "image")[];
	thinkingFormat?: ThinkingFormat;
}[] = [
	// ---- Qwen 3.6 ----
	{ id: "qwen3.6-plus", name: "Qwen 3.6 Plus", reasoning: true, contextWindow: 1_048_576, maxTokens: 65_536, input: ["text", "image"], thinkingFormat: "qwen" },
	// ---- Qwen 3.5 ----
	{ id: "qwen3.5-plus", name: "Qwen 3.5 Plus", reasoning: true, contextWindow: 1_048_576, maxTokens: 65_536, input: ["text", "image"], thinkingFormat: "qwen" },
	// ---- Zhipu ----
	{ id: "glm-5", name: "GLM 5", reasoning: true, contextWindow: 202_752, maxTokens: 131_072, input: ["text", "image"], thinkingFormat: "openai" },
	{ id: "glm-4.7", name: "GLM 4.7", reasoning: true, contextWindow: 202_752, maxTokens: 131_072, input: ["text", "image"], thinkingFormat: "openai" },
	// ---- Kimi ----
	{ id: "kimi-k2.5", name: "Kimi K2.5", reasoning: true, contextWindow: 262_144, maxTokens: 98_304, input: ["text"], thinkingFormat: "openai" },
	// ---- MiniMax ----
	{ id: "MiniMax-M2.5", name: "MiniMax M2.5", reasoning: true, contextWindow: 196_608, maxTokens: 32_768, input: ["text"], thinkingFormat: "openai" },
];

export default async function (pi: ExtensionAPI): Promise<void> {
	const apiKey = process.env[API_KEY_ENV];

	if (!apiKey) {
		console.warn("[alibaba-cloud] DASHSCOPE_API_KEY is not set. Models will appear available but API requests will fail. Set your API key with: export DASHSCOPE_API_KEY=sk-...");
	}

	// Common compat settings for DashScope: it does not support the
	// "developer" role and uses "max_tokens" instead of "max_completion_tokens".
	const dashScopeCompat = {
		supportsDeveloperRole: false as const,
		maxTokensField: "max_tokens" as const,
	};

	const models: ProviderModelConfig[] = CODING_PLAN_MODELS.map((m) => ({
		id: m.id,
		name: m.name,
		reasoning: m.reasoning,
		input: m.input,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: m.contextWindow,
		maxTokens: m.maxTokens,
		compat: {
			...dashScopeCompat,
			...(m.thinkingFormat ? { thinkingFormat: m.thinkingFormat } : {}),
		},
	}));

	pi.registerProvider("alibaba-cloud", {
		name: "Alibaba Cloud",
		baseUrl: BASE_URL,
		apiKey: API_KEY_ENV,
		authHeader: true,
		api: "openai-completions",
		models,
	});
}
