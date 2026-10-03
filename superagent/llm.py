import json
import aiohttp


async def list_models(cfg):
    timeout = aiohttp.ClientTimeout(total=10)
    async with aiohttp.ClientSession(timeout=timeout) as s:
        async with s.get(f"{cfg['ollama_host']}/api/tags") as r:
            r.raise_for_status()
            data = await r.json()
    return [m["name"] for m in data.get("models", [])]


async def unload(cfg, model):
    """Evict a model from VRAM/RAM immediately (keep_alive = 0)."""
    timeout = aiohttp.ClientTimeout(total=30)
    async with aiohttp.ClientSession(timeout=timeout) as s:
        async with s.post(
            f"{cfg['ollama_host']}/api/generate",
            json={"model": model, "keep_alive": 0},
        ) as r:
            r.raise_for_status()


async def stream_chat(cfg, model, messages, think=None, options=None, tools=None):
    """Yield raw Ollama /api/chat chunks (dicts)."""
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "think": cfg["think"] if think is None else think,
        "keep_alive": cfg["keep_alive"],
        "options": {
            "num_ctx": cfg["num_ctx"],
            "temperature": cfg["temperature"],
            **(options or {}),
        },
    }
    if tools:
        payload["tools"] = tools

    # no total timeout: a 26B model split across CPU/GPU can be slow to first token
    timeout = aiohttp.ClientTimeout(total=None, sock_connect=10)
    async with aiohttp.ClientSession(timeout=timeout) as s:
        async with s.post(f"{cfg['ollama_host']}/api/chat", json=payload) as r:
            if r.status != 200:
                raise RuntimeError(f"Ollama {r.status}: {(await r.text())[:300]}")
            async for line in r.content:
                line = line.strip()
                if line:
                    yield json.loads(line)
