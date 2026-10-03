import json
import os

_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config.json")

DEFAULTS = {
    "ollama_host": "http://127.0.0.1:11434",
    "default_model": "gemma4:26b",
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
    except FileNotFoundError:
        pass
    return cfg
