import json
import os

_ROOT_DIR = os.path.dirname(os.path.dirname(__file__))
_PATH = os.path.join(_ROOT_DIR, "config.json")
_LOCAL_PATH = os.path.join(_ROOT_DIR, "config.local.json")

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
6. LOADING & SWITCHING WORKFLOWS: When the user asks to use, load, or switch to a specific workflow (such as "template_krea2_t2i", "template_krea2_portrait_9x16", "krea2", etc.):
   - You have access to workflow templates listed under AVAILABLE WORKFLOW TEMPLATES.
   - Output: [ACTION:LOAD_WORKFLOW name="<workflow_name>" prompt="<optional prompt to generate>"]
   - The engine will automatically load that complete graph onto the ComfyUI canvas, set the prompt, and run it!
7. INTERACTIVE GUIDED OPTIONS: Whenever you ask the user a question (such as asking for preferred model, resolution/aspect ratio, image style, or next steps), provide selectable quick-options using the tag:
   [OPTIONS: "Option 1" | "Option 2" | "Option 3"]
   Examples:
   - When asking for aspect ratio: [OPTIONS: "Square 1:1 (1024x1024)" | "Portrait 9:16 (576x1024)" | "Landscape 16:9 (1024x576)"]
   - When asking for style: [OPTIONS: "Cinematic" | "Photorealistic" | "Anime" | "Fantasy Art"]
   - When suggesting actions: [OPTIONS: "⚡ Generate Image" | "🎨 Change Style" | "📁 Switch Workflow"]
   The UI will render these as clickable option buttons so the user can easily click to answer.

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
    "interactive_options": True,
    "system_prompt": AGENT_SYSTEM_PROMPT,
}


def load():
    """Load configuration with layered overrides:
    1. Built-in DEFAULTS
    2. Base config.json (git-tracked template)
    3. User overrides from config.local.json (git-ignored for security)
    4. Environment variable fallbacks
    """
    cfg = dict(DEFAULTS)

    # 1. Base template
    try:
        with open(_PATH, "r", encoding="utf-8") as f:
            cfg.update(json.load(f))
    except (FileNotFoundError, json.JSONDecodeError):
        pass

    # 2. Local secrets and user configurations (ignored by git)
    try:
        with open(_LOCAL_PATH, "r", encoding="utf-8") as f:
            cfg.update(json.load(f))
    except (FileNotFoundError, json.JSONDecodeError):
        pass

    # 3. Environment variable fallback if api_key not set in config
    if not cfg.get("api_key"):
        prov = cfg.get("provider", "ollama").lower()
        if prov == "nvidia":
            cfg["api_key"] = os.environ.get("NVIDIA_API_KEY", "")
        elif prov == "openai":
            cfg["api_key"] = os.environ.get("OPENAI_API_KEY", "")
        elif prov == "gemini":
            cfg["api_key"] = os.environ.get("GEMINI_API_KEY", os.environ.get("GOOGLE_API_KEY", ""))

    return cfg


def save(new_cfg):
    """Save user settings and API keys to config.local.json.
    This ensures API keys and personal credentials are NEVER committed or pushed to Git/GitHub.
    """
    cfg = load()
    cfg.update(new_cfg)
    with open(_LOCAL_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)
    return cfg
