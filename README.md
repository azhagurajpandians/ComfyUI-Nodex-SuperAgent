# ComfyUI-Nodex-SuperAgent

Nodex SuperAgent: local agent inside ComfyUI, powered by Ollama. Floating chat window (or dock it to the left) with streaming responses.

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
git clone https://github.com/dreamsin3d/ComfyUI-Nodex-SuperAgent.git
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

## Configuration

Edit `config.json`. Changes apply on the next request, no restart needed.

| Key | Default | Notes |
|---|---|---|
| `ollama_host` | `http://127.0.0.1:11434` | Point to a remote host to offload the LLM |
| `default_model` | `gemma4:26b` | Model preselected in the panel |
| `keep_alive` | `5m` | How long Ollama keeps the model loaded after the last request. Set to `0` to evict immediately after reply |
| `num_ctx` | `8192` | Context window per request. Keep low to save VRAM/RAM |
| `temperature` | `0.3` | Low for routing and tool use |
| `think` | `false` | Thinking mode. Off for speed |
| `system_prompt` | terse, plain text | Prepended to every chat |

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/superagent/models` | List installed Ollama models and the default |
| POST | `/superagent/chat` | Stream a chat. Body: `{model, messages, think?}`. Response: NDJSON chunks `{content, thinking, tool_calls, done}` or `{error, done}` |
| POST | `/superagent/unload` | Evict a model from memory. Body: `{model}` |

## Panel controls

- **⚡ launcher** (bottom-right): open or close the chat window
- **Float mode** (default): drag the header to move, drag the bottom-right corner to resize
- **⇤ / ❐ button:** dock the chat to the left side of the page, or float it again. In docked mode, drag the right edge to change the width
- **Model dropdown:** choose from installed Ollama models
- **Unload:** free the selected model from VRAM/RAM
- **Clear:** reset the conversation
- **Enter** sends, **Shift+Enter** adds a newline

Window state (open/closed, mode, position, size) is remembered in the browser. Docked offsets are set by `DOCK_LEFT` and `DOCK_TOP` at the top of `web/superagent_panel.js`.

## Hardware notes

A 26B model at Q4_K_M will not fit in 8 GB VRAM. Ollama splits it across GPU and system RAM, so the first token is slow and generation is slower than a fully GPU-resident model. Do not keep the LLM and a ComfyUI generation loaded at the same time on a small GPU. Use **Unload** (or a short `keep_alive`) before heavy generations.

Check the CPU/GPU split with `ollama ps`, and speed with `ollama run <model> --verbose`.

## Troubleshooting

| Symptom | Check |
|---|---|
| No ⚡ button | Folder name is `ComfyUI-Nodex-SuperAgent`; restart ComfyUI; check console for import errors |
| "Ollama unreachable" | Ollama is running; `ollama_host` in `config.json` is correct |
| Model list empty | Run `ollama list`; pull a model |
| Very slow first reply | Model is loading and splitting across CPU/GPU. Normal on 8 GB VRAM |
| Panel loads but chat errors | Open browser dev console (F12) and ComfyUI console for the message |

## Roadmap

- **Phase 2:** ComfyUI tool layer (`queue_prompt`, progress, results), native tool calling, VRAM manager (unload LLM before generation, free ComfyUI models after)
- **Phase 3:** workflow templates with exposed params, router
- **Phase 4:** planner loop with confirm gate and step/retry caps
- **Phase 5+:** vision critic, self-healing on errors, memory, pipeline integrations (EXR/OCIO, Kitsu), scheduler
