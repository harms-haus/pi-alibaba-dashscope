import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// =============================================================================
// Alibaba Cloud (DashScope) Provider Extension for pi-agent
//
// Identifies available models by querying the DashScope /v1/models endpoint
// and registers them as an OpenAI-compatible provider.
//
// Usage:
//   export DASHSCOPE_API_KEY=sk-...
//   pi -e ./alibaba-cloud.ts
//
// Or copy to ~/.pi/agent/extensions/ for auto-discovery.
// =============================================================================

const BASE_URL = "https://coding-intl.dashscope.aliyuncs.com/v1";
const API_KEY_ENV = "DASHSCOPE_API_KEY";

// Whether to attempt dynamic model discovery via /v1/models.
// The coding-intl endpoint (Alibaba Cloud Coding Plan) does NOT expose /v1/models,
// so this should be left false for coding-plan keys (sk-sp-*). Set to true only
// if you are using a standard DashScope API key against the compatible-mode endpoint.
const FETCH_MODELS = false;

// Keywords that indicate a model is NOT a chat / text-completion model.
const NON_CHAT_KEYWORDS = [
	"embedding",
	"embed",
	"text-embedding",
	"tts",
	"speech",
	"audio",
	"voice",
	"image",
	"flux",
	"wan",
	"svd",
	"cosyvoice",
	"sambert",
	"dubbing",
	"paraformer",
	"funasr",
	"vector",
	"search",
	"ocr",
	"qwen-omni",
];

// Models available on the Alibaba Cloud Coding Plan (coding-intl endpoint).
// The coding-intl endpoint does not expose /v1/models, so this list is the
// authoritative source. Keep it in sync with the Coding Plan dashboard.
//
// Context window and max output values sourced from:
//   https://www.alibabacloud.com/help/en/model-studio/developer-reference/models
const CODING_PLAN_MODELS: {
	id: string;
	name: string;
	reasoning: boolean;
	contextWindow: number;
	maxTokens: number;
	thinkingFormat?: "qwen" | "deepseek";
}[] = [
	// ---- Qwen 3.6 ----
	// { id: "qwen3.6-max-preview", name: "Qwen 3.6 Max Preview", reasoning: true, contextWindow: 262_144, maxTokens: 65_536, thinkingFormat: "qwen" },
	{ id: "qwen3.6-plus", name: "Qwen 3.6 Plus", reasoning: true, contextWindow: 1_048_576, maxTokens: 65_536, thinkingFormat: "qwen" },
	// { id: "qwen3.6-plus-2026-04-02", name: "Qwen 3.6 Plus (2026-04-02)", reasoning: true, contextWindow: 1_048_576, maxTokens: 65_536, thinkingFormat: "qwen" },
	// { id: "qwen3.6-flash", name: "Qwen 3.6 Flash", reasoning: true, contextWindow: 1_048_576, maxTokens: 65_536, thinkingFormat: "qwen" },
	// { id: "qwen3.6-flash-2026-04-16", name: "Qwen 3.6 Flash (2026-04-16)", reasoning: true, contextWindow: 1_048_576, maxTokens: 65_536, thinkingFormat: "qwen" },
	// ---- Qwen 3.5 ----
	{ id: "qwen3.5-plus", name: "Qwen 3.5 Plus", reasoning: true, contextWindow: 1_048_576, maxTokens: 65_536, thinkingFormat: "qwen" },
	// { id: "qwen3.5-plus-2026-02-15", name: "Qwen 3.5 Plus (2026-02-15)", reasoning: true, contextWindow: 1_048_576, maxTokens: 65_536, thinkingFormat: "qwen" },
	// { id: "qwen3.5-flash", name: "Qwen 3.5 Flash", reasoning: true, contextWindow: 1_048_576, maxTokens: 65_536, thinkingFormat: "qwen" },
	// { id: "qwen3.5-flash-2026-02-23", name: "Qwen 3.5 Flash (2026-02-23)", reasoning: true, contextWindow: 1_048_576, maxTokens: 65_536, thinkingFormat: "qwen" },
	// { id: "qwen3.5-397b-a17b", name: "Qwen 3.5 397B-A17B", reasoning: true, contextWindow: 262_144, maxTokens: 65_536, thinkingFormat: "qwen" },
	// { id: "qwen3.5-122b-a10b", name: "Qwen 3.5 122B-A10B", reasoning: true, contextWindow: 262_144, maxTokens: 65_536, thinkingFormat: "qwen" },
	// { id: "qwen3.5-27b", name: "Qwen 3.5 27B", reasoning: true, contextWindow: 262_144, maxTokens: 65_536, thinkingFormat: "qwen" },
	// { id: "qwen3.5-35b-a3b", name: "Qwen 3.5 35B-A3B", reasoning: true, contextWindow: 262_144, maxTokens: 65_536, thinkingFormat: "qwen" },
	// ---- DeepSeek ----
	// { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", reasoning: true, contextWindow: 1_048_576, maxTokens: 393_216, thinkingFormat: "deepseek" },
	// { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", reasoning: true, contextWindow: 1_048_576, maxTokens: 393_216, thinkingFormat: "deepseek" },
	// ---- Zhipu ----
	{ id: "glm-5", name: "GLM 5", reasoning: true, contextWindow: 202_752, maxTokens: 131_072 },
	{ id: "glm-4.7", name: "GLM 4.7", reasoning: true, contextWindow: 202_752, maxTokens: 131_072 },
	// ---- Kimi ----
	{ id: "kimi-k2.5", name: "Kimi K2.5", reasoning: true, contextWindow: 262_144, maxTokens: 98_304 },
	// ---- MiniMax ----
	{ id: "MiniMax-M2.5", name: "MiniMax M2.5", reasoning: true, contextWindow: 196_608, maxTokens: 32_768 },
];

interface DashScopeModel {
	id: string;
}

interface DashScopeModelsResponse {
	object: string;
	data: DashScopeModel[];
}

function isChatModel(id: string): boolean {
	const lower = id.toLowerCase();
	return !NON_CHAT_KEYWORDS.some((kw) => lower.includes(kw));
}

function getModelDefaults(id: string) {
	const known = CODING_PLAN_MODELS.find((m) => m.id === id);
	if (known) {
		return {
			contextWindow: known.contextWindow,
			maxTokens: known.maxTokens,
			reasoning: known.reasoning,
		};
	}
	return {
		contextWindow: 1_048_576,
		maxTokens: 65_536,
		reasoning: false,
	};
}

export default async function (pi: ExtensionAPI) {
	const apiKey = process.env[API_KEY_ENV];

	// Common compat settings for DashScope: it does not support the
	// "developer" role and uses "max_tokens" instead of "max_completion_tokens".
	const dashScopeCompat = {
		supportsDeveloperRole: false as const,
		maxTokensField: "max_tokens" as const,
	};

	let models: {
		id: string;
		name: string;
		reasoning: boolean;
		input: ("text" | "image")[];
		cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
		contextWindow: number;
		maxTokens: number;
		compat?: typeof dashScopeCompat & { thinkingFormat?: string };
	}[] = [];

	if (apiKey && FETCH_MODELS) {
		try {
			const res = await fetch(`${BASE_URL}/models`, {
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
				},
			});

			if (res.ok) {
				const payload = (await res.json()) as DashScopeModelsResponse;
				const data = payload?.data ?? [];

				models = data
					.filter((m) => isChatModel(m.id))
					.map((m) => {
						const defaults = getModelDefaults(m.id);
						return {
							id: m.id,
							name: m.id,
							reasoning: defaults.reasoning,
							input: ["text", "image"] as ("text" | "image")[],
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
							contextWindow: defaults.contextWindow,
							maxTokens: defaults.maxTokens,
							compat: dashScopeCompat,
						};
					});
			} else {
				console.warn(`[alibaba-cloud] Could not fetch models: ${res.status} ${res.statusText}`);
			}
		} catch (err) {
			console.warn(`[alibaba-cloud] Failed to query models endpoint: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	// If dynamic discovery is disabled or the fetch failed, use the curated
	// Coding Plan model list.
	if (models.length === 0) {
		models = CODING_PLAN_MODELS.map((m) => ({
			id: m.id,
			name: m.name,
			reasoning: m.reasoning,
			input: ["text", "image"] as ("text" | "image")[],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: m.contextWindow,
			maxTokens: m.maxTokens,
			compat: {
				...dashScopeCompat,
				...(m.thinkingFormat ? { thinkingFormat: m.thinkingFormat } : {}),
			},
		}));
	}

	pi.registerProvider("alibaba-cloud", {
		name: "Alibaba Cloud",
		baseUrl: BASE_URL,
		apiKey: API_KEY_ENV,
		authHeader: true,
		api: "openai-completions",
		models,
	});
}
