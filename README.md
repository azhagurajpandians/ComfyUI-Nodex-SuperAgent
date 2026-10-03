# ComfyUI-Nodex-SuperAgent

Nodex SuperAgent: an AI assistant inside ComfyUI, supporting local models (Ollama) and cloud APIs (NVIDIA NIM, Google Gemini, OpenAI). Floating chat window (or dock it to the left) with streaming responses.

**Status:** Phase 1 (skeleton). Chat only. No tool calling or workflow execution yet.

## Requirements

- ComfyUI (portable build, Windows)
- [Ollama](https://ollama.com) 0.30.0 or newer, running locally
- A pulled model, e.g. `ollama pull gemma4:26b`

No extra Python packages needed. Uses `aiohttp`, which ships with ComfyUI.

## Install

**Option A (Git Clone - Recommended):**
```bash
cd ComfyUI_windows_portable/ComfyUI/custom_nodes
git clone https://github.com/azhagurajpandians/ComfyUI-Nodex-SuperAgent.git
```

**Option B (Manual):**
1. Copy or extract the `ComfyUI-Nodex-SuperAgent` folder into:
   ```
   ComfyUI_windows_portable\ComfyUI\custom_nodes\
   ```

2. Start Ollama.
3. Restart ComfyUI.
4. Click the floating **⚡** button (bottom-right) to open the chat window.

## Structure

```
ComfyUI-Nodex-SuperAgent/
├─ __init__.py          # registers routes + web directory
├─ config.json          # settings (re-read on every request)
├─ superagent/
│  ├─ config.py         # config loader with defaults
│  ├─ llm.py            # Ollama client: list, stream chat, unload
│  └─ routes.py         # /superagent/* HTTP endpoints
└─ web/
   └─ superagent_panel.js    # floating / docked chat window
```

## Supported Providers & Integrations

Nodex SuperAgent supports multiple LLM backends:

1. **Ollama (Local)**: Runs locally on your system (`http://127.0.0.1:11434`).
2. **NVIDIA NIM (Cloud API)**: Offload LLM inference entirely to NVIDIA's cloud with zero local GPU VRAM impact. Free API keys available at [build.nvidia.com](https://build.nvidia.com).
3. **Google Gemini (Cloud API)**: Fast responses and large context windows via Google AI Studio (`gemini-2.0-flash`, `gemini-1.5-pro`).
4. **OpenAI (Cloud API)**: Direct OpenAI endpoint (`gpt-4o`, `gpt-4o-mini`, `o3-mini`).
5. **Custom / OpenAI-Compatible**: Any endpoint like Groq, OpenRouter, DeepSeek, vLLM, or LMStudio.

> **💡 Low VRAM Tip:** If Ollama hits CUDA Out of Memory (OOM) because ComfyUI is using your GPU, click **⚙ (Settings)** in the panel header, select **NVIDIA NIM** or **Google Gemini**, enter your API key, and chat without using any local VRAM!

## Configuration

You can configure settings directly inside ComfyUI by clicking the **⚙** button in the chat header, or by editing `config.json`. Changes apply immediately without restarting ComfyUI.

| Key | Default | Notes |
|---|---|---|
| `provider` | `ollama` | Provider: `ollama`, `nvidia`, `openai`, `gemini`, or `custom` |
| `api_key` | `""` | API key for cloud providers (`nvapi-...`, `sk-...`, `AIzaSy...`) |
| `base_url` | auto | Base URL endpoint for the selected provider |
| `ollama_host` | `http://127.0.0.1:11434` | Ollama host address |
| `default_model` | `llama3.1:8b` | Preselected model identifier |
| `keep_alive` | `5m` | Ollama model unload timeout (`0` = unload immediately after reply) |
| `num_ctx` | `8192` | Context window size / max tokens |
| `temperature` | `0.3` | Sampling temperature |
| `think` | `false` | Thinking mode for supported reasoning models |
| `system_prompt` | terse, plain text | Prepended to every chat |

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/superagent/config` | Retrieve current configuration and provider presets |
| POST | `/superagent/config` | Update and persist settings to `config.json` |
| GET | `/superagent/models` | List available models for the active provider |
| POST | `/superagent/chat` | Stream chat. Body: `{model, messages, think?}`. NDJSON response |
| POST | `/superagent/unload` | Evict local model from memory (Ollama only) |

## Panel controls

- **⚡ launcher** (bottom-right): open or close the chat window
- **⚙ Settings** (header): configure provider (Ollama, NVIDIA NIM, Gemini, OpenAI, Custom), API keys, endpoints, and parameters
- **Float mode** (default): drag the header to move, drag the bottom-right corner to resize
- **⇤ / ❐ button:** dock the chat to the left side of the page, or float it again. In docked mode, drag the right edge to change the width
- **Model dropdown:** select available models or enter a custom model
- **Unload:** free the active local model from GPU VRAM/RAM (Ollama)
- **Clear:** reset the conversation
- **Enter** sends, **Shift+Enter** adds a newline

Window state (open/closed, mode, position, size) is remembered in the browser. Docked offsets are set by `DOCK_LEFT` and `DOCK_TOP` at the top of `web/superagent_panel.js`.

## Hardware notes

A 26B model at Q4_K_M will not fit in 8 GB VRAM. Ollama splits it across GPU and system RAM, so the first token is slow and generation is slower than a fully GPU-resident model. Do not keep the LLM and a ComfyUI generation loaded at the same time on a small GPU. Use **Unload** (or a short `keep_alive`) before heavy generations, or switch to a cloud provider (NVIDIA NIM, Google Gemini, OpenAI) to completely bypass local GPU limits.

Check the CPU/GPU split with `ollama ps`, and speed with `ollama run <model> --verbose`.

## Troubleshooting

| Symptom | Check |
|---|---|
| No ⚡ button | Folder name is `ComfyUI-Nodex-SuperAgent`; restart ComfyUI; check console for import errors |
| "Ollama unreachable" | Ollama is running; `ollama_host` in `config.json` is correct |
| Model list empty | Run `ollama list`; pull a model, or check API key in Settings (⚙) |
| Very slow first reply | Local model is loading and splitting across CPU/GPU. Normal on 8 GB VRAM |
| Panel loads but chat errors | Open browser dev console (F12) and ComfyUI console for the message |
