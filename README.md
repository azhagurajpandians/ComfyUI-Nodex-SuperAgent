# ComfyUI-Nodex-SuperAgent

<p align="center">
  <img src="https://raw.githubusercontent.com/azhagurajpandians/ComfyUI-Nodex-SuperAgent/main/assets/nodex-superagent-icon.png" alt="Nodex SuperAgent icon" width="160" />
</p>

Nodex SuperAgent: an AI assistant inside ComfyUI, supporting local models (Ollama) and cloud APIs (NVIDIA NIM, Google Gemini, OpenAI). Floating chat window (or dock it to either side) with streaming responses.

**Status:** Workflow orchestrator prototype. It plans a single generation run, routes to a declared skill, loads the selected ComfyUI visual graph onto the canvas, fills mapped inputs, queues it, and returns image/video outputs. Multi-step production pipelines remain future work.

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
│  ├─ catalog.py        # discovers bundled and saved ComfyUI visual workflows
│  ├─ registry.py       # validates skill definitions and graph input bindings
│  ├─ orchestrator.py   # ranks task/skill routes and explains the selected plan
│  ├─ skills.json       # declarative skill capabilities, aliases, settings, and input mappings
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

## Workflow Orchestration

The orchestrator uses ComfyUI **visual workflow graphs**. It loads the selected graph onto the canvas with ComfyUI's frontend, fills the declared prompt/image widgets, then queues the graph through the normal UI. It does not require converting visual workflows to API-format prompt graphs.

The catalog scans this extension's `workflows/` folder and saved GUI workflows under `ComfyUI/user/<profile>/workflows/`. Skills in `superagent/skills.json` bind user language and aliases to exact workflow files and input selectors. A named workflow request is routed before generation; when the requested skill or workflow is unavailable, the active canvas is not used as a fallback.

Routes included in this checkout:

- Krea 2 text-to-image, landscape, portrait, and image-to-image using the bundled Krea graphs.
- Qwen Image character-reference generation using the saved Qwen character-reference workflow.
- LTX text-to-video and image-to-video using the saved LTX graphs. Video upload is not enabled, so video-edit/face-swap routes report that required input instead of queueing.
- Qwen Image Edit and MiniMax are represented as routes but are **unavailable** until a matching visual workflow is saved and registered. The current saved Qwen graph is character-reference generation, not an edit graph; no MiniMax workflow was found.

To add a route, save the ComfyUI visual workflow under a user `workflows/` directory, then add a skill entry in `superagent/skills.json` with aliases, task, exact `workflow_name`, and prompt/image selectors. Selector node IDs/titles and widget names must match the graph. Do not register a workflow as image editing unless it has a working image input wired into its graph.

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
| POST | `/superagent/config` | Update and persist settings to the ignored `config.local.json` |
| GET | `/superagent/models` | List available models for the active provider |
| GET | `/superagent/workflows` | List bundled/saved visual graphs and registered skills |
| POST | `/superagent/plan` | Build a deterministic skill/workflow route from a user request |
| POST | `/superagent/enhance_prompt` | Expand a request into a workflow-ready visual prompt when the chat model omits one |
| POST | `/superagent/preflight` | Check machine/workflow readiness and return mode/resolution advice before queueing |
| GET | `/superagent/workflow?id=...` | Return an exact cataloged GUI workflow graph for canvas loading |
| POST | `/superagent/chat` | Stream chat. Body: `{model, messages, workflow_context}`. NDJSON response; API keys are never returned by config reads |
| POST | `/superagent/unload` | Evict local model from memory (Ollama only) |

## Panel controls

- **⚡ launcher** (bottom-right): open or close the chat window
- **⚙ Settings** (header): configure provider (Ollama, NVIDIA NIM, Gemini, OpenAI, Custom), API keys, endpoints, and parameters
- **Float mode** (default): drag the header to move, drag the bottom-right corner to resize
- **Dock button:** cycle between float, left dock, and right dock. In docked mode, drag the inner edge to change the width
- **Guide:** open a quick usage guide with examples and the image order/limits declared for available image workflows
- **Model dropdown:** select available models or enter a custom model
- **Unload:** free the active local model from GPU VRAM/RAM (Ollama)
- **Clear:** reset the conversation
- **Generation**: the orchestrator loads the skill's visual graph, sets its declared inputs, queues it, tracks progress, and displays image/video outputs.
- **Preflight adviser**: before generation, reports the selected workflow mode, its saved or requested resolution, installed model-file checks, GPU/VRAM and system RAM when available. It waits for the user's **Load workflow and queue** choice. Missing required workflow model files block queueing.
- **Route feedback**: the panel shows which skill was selected and reports missing workflows/inputs. It never silently substitutes the active canvas for an unavailable named route.
- **Image follow-ups**: a short continuation or edit can reuse the latest uploaded image; unrelated new generation requests do not send older image pixels back to the model.
- **Skill routing**: the registry validates each skill against its saved graph and exposes route rationale, required inputs/model files, and ranked alternatives.
- **Enter** sends, **Shift+Enter** adds a newline

Window state (open/closed, mode, position, size) is remembered in the browser. Dock offsets are set by `DOCK_LEFT`, `DOCK_RIGHT`, and `DOCK_TOP` at the top of `web/superagent_panel.js`.

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
