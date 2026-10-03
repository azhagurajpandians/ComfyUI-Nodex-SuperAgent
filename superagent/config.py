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

DEFAULTS = {
    "provider": "ollama",
    "ollama_host": "http://127.0.0.1:11434",
    "base_url": "http://127.0.0.1:11434",
    "api_key": "",
    "default_model": "llama3.1:8b",
    "keep_alive": "5m",
    "num_ctx": 8192,
    "temperature": 0.3,
    "think": False,
    "system_prompt": "You are Nodex SuperAgent, an agent inside ComfyUI. Be terse and direct. Plain text only.",
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
