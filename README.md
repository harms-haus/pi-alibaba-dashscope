# pi-alibaba-dashscope

Alibaba Cloud (DashScope) provider extension for [pi-agent](https://github.com/earendil-works/pi-coding-agent).

## Install

```bash
pi install git:github.com/harms-haus/pi-alibaba-dashscope
```

Or clone and symlink into `~/.pi/agent/extensions/`.

## Usage

Set your API key and run pi:

```bash
export DASHSCOPE_API_KEY=sk-...
pi
```

Then select an Alibaba Cloud model via `/model` or `Ctrl+L`.

## Supported Models

This extension provides a curated set of models available on the Alibaba Cloud **Coding Plan** (coding-intl endpoint). Models are registered statically — no dynamic discovery is performed.

| Model | Context Window | Max Output | Multimodal | Reasoning |
|---|---|---|---|---|
| Qwen 3.6 Plus | 1M | 65K | ✅ | ✅ |
| Qwen 3.5 Plus | 1M | 65K | ✅ | ✅ |
| GLM 5 | 200K | 131K | ✅ | ✅ |
| GLM 4.7 | 200K | 131K | ✅ | ✅ |
| Kimi K2.5 | 262K | 98K | ❌ | ✅ |
| MiniMax M2.5 | 196K | 32K | ❌ | ✅ |

## Development

```bash
npm install        # install dev dependencies
npm run typecheck  # check TypeScript types
npm run lint       # run ESLint
npm test           # run tests
```
