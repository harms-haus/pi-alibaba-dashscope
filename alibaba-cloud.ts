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
const CODING_PLAN_MODELS: {
	id: string;
	name: string;
	reasoning: boolean;
	contextWindow: number;
	maxTokens: number;
}[] = [
	// Qwen family
	{ id: "qwen3.6-plus", name: "Qwen 3.6 Plus", reasoning: true, contextWindow: 131_072, maxTokens: 16_384 },
	{ id: "qwen3.5-plus", name: "Qwen 3.5 Plus", reasoning: true, contextWindow: 131_072, maxTokens: 16_384 },
	{ id: "qwen3-max-2026-01-23", name: "Qwen 3 Max", reasoning: true, contextWindow: 32_768, maxTokens: 8_192 },
	{ id: "qwen3-coder-next", name: "Qwen 3 Coder Next", reasoning: false, contextWindow: 131_072, maxTokens: 16_384 },
	{ id: "qwen3-coder-plus", name: "Qwen 3 Coder Plus", reasoning: false, contextWindow: 131_072, maxTokens: 16_384 },
	// Zhipu family
	{ id: "glm-5", name: "GLM 5", reasoning: true, contextWindow: 128_000, maxTokens: 16_384 },
	{ id: "glm-4.7", name: "GLM 4.7", reasoning: true, contextWindow: 128_000, maxTokens: 16_384 },
	// Kimi family
	{ id: "kimi-k2.5", name: "Kimi K2.5", reasoning: true, contextWindow: 131_072, maxTokens: 16_384 },
	// MiniMax family
	{ id: "MiniMax-M2.5", name: "MiniMax M2.5", reasoning: true, contextWindow: 1_048_576, maxTokens: 16_384 },
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
		contextWindow: 128_000,
		maxTokens: 8192,
		reasoning: false,
	};
}

export default async function (pi: ExtensionAPI) {
	const apiKey = process.env[API_KEY_ENV];
	let models: {
		id: string;
		name: string;
		reasoning: boolean;
		input: ("text" | "image")[];
		cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
		contextWindow: number;
		maxTokens: number;
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
