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

// Known DashScope chat models with sensible defaults (fallback when API key is missing or fetch fails)
const FALLBACK_MODELS: {
	id: string;
	name: string;
	reasoning: boolean;
	contextWindow: number;
	maxTokens: number;
}[] = [
	{ id: "qwen-max", name: "Qwen Max", reasoning: true, contextWindow: 32_768, maxTokens: 8192 },
	{ id: "qwen-max-latest", name: "Qwen Max (latest)", reasoning: true, contextWindow: 32_768, maxTokens: 8192 },
	{ id: "qwen-plus", name: "Qwen Plus", reasoning: true, contextWindow: 131_072, maxTokens: 8192 },
	{ id: "qwen-plus-latest", name: "Qwen Plus (latest)", reasoning: true, contextWindow: 131_072, maxTokens: 8192 },
	{ id: "qwen-turbo", name: "Qwen Turbo", reasoning: false, contextWindow: 131_072, maxTokens: 8192 },
	{ id: "qwen-turbo-latest", name: "Qwen Turbo (latest)", reasoning: false, contextWindow: 131_072, maxTokens: 8192 },
	{ id: "qwen-coder-plus", name: "Qwen Coder Plus", reasoning: true, contextWindow: 131_072, maxTokens: 8192 },
	{ id: "qwen-coder-plus-latest", name: "Qwen Coder Plus (latest)", reasoning: true, contextWindow: 131_072, maxTokens: 8192 },
	{ id: "deepseek-v3", name: "DeepSeek V3", reasoning: true, contextWindow: 64_000, maxTokens: 8192 },
	{ id: "deepseek-r1", name: "DeepSeek R1", reasoning: true, contextWindow: 64_000, maxTokens: 8192 },
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
	const known = FALLBACK_MODELS.find((m) => m.id === id);
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

	if (apiKey) {
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

	// If the API key is missing or the fetch failed, fall back to the static list
	// so the provider is still available for /model selection.
	if (models.length === 0) {
		models = FALLBACK_MODELS.map((m) => ({
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
