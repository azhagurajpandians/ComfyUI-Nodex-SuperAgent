import json
import os

_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config.json")

PROVIDER_PRESETS = {
    "ollama": {
        "base_url": "http://127.0.0.1:11434",
        "default_model": "llama3.1:8b",
        "requires_key": False,
    },
    "nvidia": {
        "base_url": "https://integrate.api.nvidia.com/v1",
        "default_model": "meta/llama-3.3-70b-instruct",
        "requires_key": True,
    },
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "default_model": "gpt-4o-mini",
        "requires_key": True,
    },
    "gemini": {
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "default_model": "gemini-2.0-flash",
        "requires_key": True,
    },
    "custom": {
        "base_url": "",
        "default_model": "",
        "requires_key": False,
    },
}

AGENT_SYSTEM_PROMPT = """You are Nodex SuperAgent, an intelligent AI assistant embedded directly inside ComfyUI with direct control over the canvas, prompt nodes, and execution pipeline.

CAPABILITIES & EXECUTION PROTOCOL:
1. WORKFLOW INSPECTION: You have live visibility into the user's active canvas workflow provided in the context (active checkpoint model, positive prompt, negative prompt, sampler, steps, cfg, and node types). When the user asks to check, read, or inspect their workflow, give an accurate, expert breakdown based on this context.
2. PROMPT CRAFTING: You are a master prompt engineer for Stable Diffusion (SD 1.5, SDXL) and Flux. Craft vivid, detailed, atmospheric prompts with strong subject focus, lighting, composition, and style.
3. GENERATING IMAGES: When the user asks to generate, create, make, run, or render an image (e.g. "generate an image of spider man"):
   - Craft a compelling, highly detailed prompt.
   - Include the action tag in your response:
     [ACTION:GENERATE_IMAGE prompt="<your detailed prompt>"]
   - The embedded ComfyUI engine will automatically update the positive prompt node on the canvas, queue the generation, and display the resulting image directly in this chat!
4. UPDATING PROMPTS: When the user asks to change or update prompts on the canvas without generating yet:
   - Output: [ACTION:SET_PROMPT positive="<prompt text>" negative="<optional negative text>"]
5. RUNNING THE WORKFLOW: When the user asks to run, queue, or execute the existing canvas workflow:
   - Output: [ACTION:RUN_WORKFLOW]

Always be proactive, creative, and execute the requested actions directly instead of telling the user you cannot interact with ComfyUI."""

DEFAULTS = {
    "provider": "ollama",
    "ollama_host": "http://127.0.0.1:11434",
    "base_url": "http://127.0.0.1:11434",
    "api_key": "",
    "default_model": "llama3.1:8b",
    "keep_alive": "5m",
    "num_ctx": 8192,
    "temperature": 0.4,
    "think": False,
    "system_prompt": AGENT_SYSTEM_PROMPT,
}


def load():
    """Re-read config.json on every call so edits apply without a restart."""
    cfg = dict(DEFAULTS)
    try:
        with open(_PATH, "r", encoding="utf-8") as f:
            cfg.update(json.load(f))
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    return cfg


def save(new_cfg):
    """Update and persist config.json."""
    cfg = load()
    cfg.update(new_cfg)
    with open(_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)
    return cfg
