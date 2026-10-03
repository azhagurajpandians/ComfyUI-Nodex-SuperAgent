import json

from aiohttp import web
from server import PromptServer

from . import config, llm

routes = PromptServer.instance.routes


def _err(msg, status=500):
    return web.json_response({"error": str(msg)}, status=status)


@routes.get("/superagent/config")
async def agent_get_config(request):
    cfg = config.load()
    presets = config.PROVIDER_PRESETS
    return web.json_response({"config": cfg, "presets": presets})


@routes.post("/superagent/config")
async def agent_save_config(request):
    try:
        body = await request.json()
    except Exception:
        return _err("Invalid JSON body", 400)

    cfg = config.save(body)
    return web.json_response({"ok": True, "config": cfg})


@routes.get("/superagent/models")
async def agent_models(request):
    cfg = config.load()
    provider = llm.get_provider(cfg)
    base_url = llm.get_base_url(cfg)
    try:
        models = await llm.list_models(cfg)
    except Exception as e:
        return _err(f"{provider.upper()} unreachable at {base_url}: {e}", 502)
    return web.json_response({
        "provider": provider,
        "models": models,
        "default": cfg.get("default_model", ""),
    })


@routes.post("/superagent/unload")
async def agent_unload(request):
    cfg = config.load()
    body = await request.json()
    try:
        await llm.unload(cfg, body.get("model") or cfg.get("default_model"))
    except Exception as e:
        return _err(e, 502)
    return web.json_response({"ok": True})


@routes.post("/superagent/chat")
async def agent_chat(request):
    cfg = config.load()
    body = await request.json()
    model = body.get("model") or cfg.get("default_model")
    system_prompt = cfg.get("system_prompt", "You are Nodex SuperAgent, an agent inside ComfyUI. Be terse and direct. Plain text only.")
    messages = [{"role": "system", "content": system_prompt}] + body.get("messages", [])

    resp = web.StreamResponse(
        headers={"Content-Type": "application/x-ndjson", "Cache-Control": "no-cache"}
    )
    await resp.prepare(request)

    async def send(obj):
        await resp.write((json.dumps(obj) + "\n").encode())

    try:
        async for chunk in llm.stream_chat(cfg, model, messages, think=body.get("think")):
            msg = chunk.get("message", {})
            await send({
                "content": msg.get("content", ""),
                "thinking": msg.get("thinking", ""),
                "tool_calls": msg.get("tool_calls"),
                "done": chunk.get("done", False),
            })
    except (ConnectionResetError, web.HTTPException):
        return resp  # client closed the panel / aborted
    except Exception as e:
        try:
            await send({"error": str(e), "done": True})
        except ConnectionResetError:
            pass

    try:
        await resp.write_eof()
    except ConnectionResetError:
        pass
    return resp
