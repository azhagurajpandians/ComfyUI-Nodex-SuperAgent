import base64
import glob
import json
import mimetypes
import os
import re

from aiohttp import web
from server import PromptServer

from . import config, llm

routes = PromptServer.instance.routes

# Directory paths for workflow files
_COMFY_ROOT = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)
_WORKFLOWS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "workflows"
)


def _err(msg, status=500):
    return web.json_response({"error": str(msg)}, status=status)


def _find_image_path(name, subfolder=""):
    if not name:
        return None
    try:
        import folder_paths
        p = folder_paths.get_annotated_filepath(name)
        if p and os.path.isfile(p):
            return p
    except Exception:
        pass

    input_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "input"))
    direct = os.path.join(input_dir, subfolder, name) if subfolder else os.path.join(input_dir, name)
    if os.path.isfile(direct):
        return direct

    direct_no_sub = os.path.join(input_dir, name)
    if os.path.isfile(direct_no_sub):
        return direct_no_sub

    if os.path.isdir(input_dir):
        for root, _, files in os.walk(input_dir):
            if name in files:
                return os.path.join(root, name)
    return None


def _get_image_base64(filepath):
    if not filepath or not os.path.isfile(filepath):
        return None, None
    mime, _ = mimetypes.guess_type(filepath)
    if not mime:
        ext = os.path.splitext(filepath)[1].lower()
        if ext in (".jpg", ".jpeg"):
            mime = "image/jpeg"
        elif ext == ".png":
            mime = "image/png"
        elif ext == ".webp":
            mime = "image/webp"
        else:
            mime = "image/png"
    try:
        with open(filepath, "rb") as f:
            encoded = base64.b64encode(f.read()).decode("utf-8")
        return mime, encoded
    except Exception as e:
        print(f"[SuperAgent] Error reading image {filepath}: {e}")
        return None, None


def _scan_workflows():
    workflows = {}
    # Scan ComfyUI root directory for .json workflow files
    if os.path.isdir(_COMFY_ROOT):
        for f in glob.glob(os.path.join(_COMFY_ROOT, "*.json")):
            base = os.path.splitext(os.path.basename(f))[0]
            workflows[base] = f

    # Scan internal workflows/ directory
    if os.path.isdir(_WORKFLOWS_DIR):
        for f in glob.glob(os.path.join(_WORKFLOWS_DIR, "*.json")):
            base = os.path.splitext(os.path.basename(f))[0]
            workflows[base] = f
    return workflows


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


@routes.get("/superagent/workflows")
async def agent_list_workflows(request):
    wfs = _scan_workflows()
    return web.json_response({"workflows": list(wfs.keys())})


@routes.get("/superagent/workflow")
async def agent_get_workflow(request):
    name = request.query.get("name", "").strip().lower()
    wfs = _scan_workflows()
    name_clean = name.lower()
    name_norm = name_clean.replace(" ", "").replace("_", "").replace("-", "")
    target_path = None
    for k, p in wfs.items():
        k_clean = k.lower()
        k_norm = k_clean.replace(" ", "").replace("_", "").replace("-", "")
        if k_clean == name_clean or name_clean in k_clean or name_norm in k_norm or k_norm in name_norm:
            target_path = p
            break

    if not target_path or not os.path.isfile(target_path):
        return _err(f"Workflow '{name}' not found. Available: {list(wfs.keys())}", 404)

    try:
        with open(target_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict) and data.get("links"):
            try:
                v = float(data.get("version", 0))
                if v < 0.4:
                    data["version"] = 0.4
            except (ValueError, TypeError):
                data["version"] = 0.4
        return web.json_response(data)
    except Exception as e:
        return _err(f"Failed to read workflow '{name}': {e}", 500)


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
    system_prompt = cfg.get("system_prompt", config.AGENT_SYSTEM_PROMPT)

    # Append available workflows list to context
    wfs = list(_scan_workflows().keys())
    if wfs:
        system_prompt += f"\n\n--- AVAILABLE WORKFLOW TEMPLATES ON SYSTEM ---\n{', '.join(wfs)}\n---------------------------------------------"

    workflow_context = body.get("workflow_context")
    if workflow_context:
        system_prompt += f"\n\n--- ACTIVE COMFYUI CANVAS WORKFLOW ---\n{workflow_context}\n---------------------------------------"

    raw_messages = body.get("messages", [])
    formatted_messages = [{"role": "system", "content": system_prompt}]
    provider = llm.get_provider(cfg)

    for msg in raw_messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        attachment = msg.get("attachment")

        img_name = None
        img_subfolder = ""
        if isinstance(attachment, dict) and attachment.get("name"):
            img_name = attachment.get("name")
            img_subfolder = attachment.get("subfolder", "")
        elif isinstance(content, str):
            m = re.search(r"\[Attached Image:\s*([^\]]+)\]", content)
            if m:
                img_name = m.group(1).strip()

        if role == "user" and img_name:
            img_path = _find_image_path(img_name, img_subfolder)
            mime, b64 = _get_image_base64(img_path) if img_path else (None, None)
            if b64:
                if provider == "ollama":
                    formatted_messages.append({
                        "role": "user",
                        "content": content,
                        "images": [b64],
                    })
                else:
                    formatted_messages.append({
                        "role": "user",
                        "content": [
                            {"type": "text", "text": content},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime};base64,{b64}"
                                }
                            }
                        ]
                    })
                continue

        formatted_messages.append({"role": role, "content": content})

    messages = formatted_messages

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
