# pi-alibaba-dashscope

Alibaba Cloud (DashScope) provider extension for pi-agent.

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

This extension queries the DashScope `/v1/models` endpoint to discover available chat models dynamically. Models like Qwen Max, Qwen Plus, Qwen Turbo, and DeepSeek (V3 & R1) are available when listed by the API.

## Provider Name

- Extension id: `alibaba-cloud`
- API Key env var: `DASHSCOPE_API_KEY`
- Endpoint: `https://coding-intl.dashscope.aliyuncs.com/v1`
