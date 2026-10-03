import json
import aiohttp
from . import config

PROVIDER_DEFAULT_MODELS = {
    "ollama": [
        "llama3.1:8b",
        "qwen2.5:14b",
        "gemma2:9b",
        "mistral:7b",
    ],
    "nvidia": [
        "meta/llama-3.2-11b-vision-instruct",
        "google/diffusiongemma-26b-a4b-it",
        "openai/gpt-oss-20b",
        "poolside/laguna-xs-2.1",
        "meta/muse-glimmer-30b",
        "nvidia/nemotron-3-ultra-550b-a55b",
    ],
    "openai": [
        "gpt-4o-mini",
        "gpt-4o",
        "o3-mini",
        "gpt-4-turbo",
    ],
    "gemini": [
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-1.5-pro",
    ],
    "custom": [],
}


def get_provider(cfg):
    return cfg.get("provider", "ollama").lower()


def get_base_url(cfg):
    provider = get_provider(cfg)
    preset = config.PROVIDER_PRESETS.get(provider, {})
    url = cfg.get("base_url") or (cfg.get("ollama_host") if provider == "ollama" else "") or preset.get("base_url", "")
    return url.rstrip("/")


async def list_models(cfg):
    provider = get_provider(cfg)
    base_url = get_base_url(cfg)
    timeout = aiohttp.ClientTimeout(total=10)

    if provider == "ollama":
        if not base_url:
            base_url = "http://127.0.0.1:11434"
        async with aiohttp.ClientSession(timeout=timeout) as s:
            async with s.get(f"{base_url}/api/tags") as r:
                r.raise_for_status()
                data = await r.json()
        models = [m["name"] for m in data.get("models", [])]
        return models if models else PROVIDER_DEFAULT_MODELS.get("ollama", [])

    # Cloud / OpenAI-compatible provider:
    api_key = cfg.get("api_key", "").strip()
    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    fallback = list(PROVIDER_DEFAULT_MODELS.get(provider, []))
    default_m = cfg.get("default_model")
    if default_m and default_m not in fallback:
        fallback.insert(0, default_m)

    if not base_url:
        return fallback

    # Attempt fetching /models from OpenAI-compatible provider
    try:
        models_url = f"{base_url}/models" if not base_url.endswith("/models") else base_url
        async with aiohttp.ClientSession(timeout=timeout) as s:
            async with s.get(models_url, headers=headers) as r:
                if r.status == 200:
                    data = await r.json()
                    fetched = [m["id"] for m in data.get("data", []) if "id" in m]
                    if fetched:
                        return fetched
    except Exception:
        pass

    return fallback


async def unload(cfg, model):
    """Evict model from memory (Ollama only; no-op for cloud APIs)."""
    provider = get_provider(cfg)
    if provider == "ollama":
        base_url = get_base_url(cfg) or "http://127.0.0.1:11434"
        timeout = aiohttp.ClientTimeout(total=30)
        async with aiohttp.ClientSession(timeout=timeout) as s:
            async with s.post(
                f"{base_url}/api/generate",
                json={"model": model, "keep_alive": 0},
            ) as r:
                r.raise_for_status()
    return True


async def stream_chat(cfg, model, messages, think=None, options=None, tools=None):
    """Stream chat responses yielding NDJSON-compatible chunks."""
    provider = get_provider(cfg)
    base_url = get_base_url(cfg)

    if provider == "ollama":
        if not base_url:
            base_url = "http://127.0.0.1:11434"
        payload = {
            "model": model,
            "messages": messages,
            "stream": True,
            "think": cfg.get("think", False) if think is None else think,
            "keep_alive": cfg.get("keep_alive", "5m"),
            "options": {
                "num_ctx": cfg.get("num_ctx", 8192),
                "temperature": cfg.get("temperature", 0.3),
                **(options or {}),
            },
        }
        if tools:
            payload["tools"] = tools

        timeout = aiohttp.ClientTimeout(total=None, sock_connect=10)
        async with aiohttp.ClientSession(timeout=timeout) as s:
            async with s.post(f"{base_url}/api/chat", json=payload) as r:
                if r.status != 200:
                    err_msg = (await r.text())[:300]
                    raise RuntimeError(f"Ollama {r.status}: {err_msg}")
                async for line in r.content:
                    line = line.strip()
                    if line:
                        yield json.loads(line)
        return

    # OpenAI-compatible / Cloud API streaming
    if not base_url:
        preset = config.PROVIDER_PRESETS.get(provider, {})
        base_url = preset.get("base_url", "https://api.openai.com/v1")

    chat_url = f"{base_url}/chat/completions" if not base_url.endswith("/chat/completions") else base_url
    api_key = cfg.get("api_key", "").strip()

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "temperature": cfg.get("temperature", 0.3),
    }
    max_tokens = cfg.get("max_tokens") or cfg.get("num_ctx")
    if max_tokens:
        payload["max_tokens"] = int(max_tokens)
    if tools:
        payload["tools"] = tools

    timeout = aiohttp.ClientTimeout(total=None, sock_connect=15)
    async with aiohttp.ClientSession(timeout=timeout) as s:
        async with s.post(chat_url, json=payload, headers=headers) as r:
            if r.status != 200:
                raw_err = await r.text()
                try:
                    err_json = json.loads(raw_err)
                    err_detail = err_json.get("error", {}).get("message") or raw_err[:300]
                except Exception:
                    err_detail = raw_err[:300]
                raise RuntimeError(f"{provider.upper()} API {r.status}: {err_detail}")

            async for raw_line in r.content:
                line = raw_line.decode("utf-8", errors="replace").strip()
                if not line or not line.startswith("data:"):
                    continue
                data_str = line[5:].strip()
                if data_str == "[DONE]":
                    yield {"message": {}, "done": True}
                    break
                try:
                    data = json.loads(data_str)
                    choices = data.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta", {})
                    content = delta.get("content") or ""
                    thinking = delta.get("reasoning_content") or delta.get("reasoning") or ""
                    tool_calls = delta.get("tool_calls")
                    finish_reason = choices[0].get("finish_reason")
                    yield {
                        "message": {
                            "content": content,
                            "thinking": thinking,
                            "tool_calls": tool_calls,
                        },
                        "done": finish_reason is not None,
                    }
                except Exception:
                    continue
