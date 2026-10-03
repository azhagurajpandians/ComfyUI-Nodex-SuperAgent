import json

from aiohttp import web
from server import PromptServer

from . import config, llm

routes = PromptServer.instance.routes


def _err(msg, status=500):
    return web.json_response({"error": str(msg)}, status=status)


@routes.get("/superagent/models")
async def agent_models(request):
    cfg = config.load()
    try:
        models = await llm.list_models(cfg)
    except Exception as e:
        return _err(f"Ollama unreachable at {cfg['ollama_host']}: {e}", 502)
    return web.json_response({"models": models, "default": cfg["default_model"]})


@routes.post("/superagent/unload")
async def agent_unload(request):
    cfg = config.load()
    body = await request.json()
    try:
        await llm.unload(cfg, body.get("model") or cfg["default_model"])
    except Exception as e:
        return _err(e, 502)
    return web.json_response({"ok": True})


@routes.post("/superagent/chat")
async def agent_chat(request):
    cfg = config.load()
    body = await request.json()
    model = body.get("model") or cfg["default_model"]
    messages = [{"role": "system", "content": cfg["system_prompt"]}] + body.get("messages", [])

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
