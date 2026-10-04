import base64
import json
import mimetypes
import os
import re

from aiohttp import web
from server import PromptServer

from . import catalog, config, llm, orchestrator, preflight, registry

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
    # Treat client-provided names as untrusted; every fallback resolution must stay
    # inside ComfyUI's input directory.
    requested = os.path.abspath(os.path.join(input_dir, subfolder, name))
    try:
        if os.path.commonpath([input_dir, requested]) == input_dir and os.path.isfile(requested):
            return requested
    except ValueError:
        pass

    basename = os.path.basename(name)
    if basename != name or not basename:
        return None
    if os.path.isdir(input_dir):
        for root, _, files in os.walk(input_dir):
            if basename in files:
                return os.path.join(root, basename)
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
    return {item["id"]: item["path"] for item in catalog.list_workflows()}


def _public_config(cfg):
    public_cfg = dict(cfg)
    public_cfg["api_key"] = "" if not cfg.get("api_key") else "********"
    return public_cfg


@routes.get("/superagent/config")
async def agent_get_config(request):
    cfg = config.load()
    presets = config.PROVIDER_PRESETS
    return web.json_response({"config": _public_config(cfg), "presets": presets})


@routes.post("/superagent/config")
async def agent_save_config(request):
    try:
        body = await request.json()
    except Exception:
        return _err("Invalid JSON body", 400)

    cfg = config.save(body)
    return web.json_response({"ok": True, "config": _public_config(cfg)})


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
    workflows = catalog.list_workflows()
    public_workflows = [{k: v for k, v in item.items() if k != "path"} for item in workflows]
    return web.json_response({"workflows": public_workflows, "skills": registry.list_skills()})


@routes.post("/superagent/plan")
async def agent_plan(request):
    try:
        body = await request.json()
    except Exception:
        return _err("Invalid JSON body", 400)
    plan = orchestrator.plan_request(
        body.get("request", ""),
        has_image=bool(body.get("has_image")),
        has_video=bool(body.get("has_video")),
        active_workflow=body.get("active_workflow"),
    )
    return web.json_response({"plan": plan})


@routes.post("/superagent/preflight")
async def agent_preflight(request):
    try:
        body = await request.json()
    except Exception:
        return _err("Invalid JSON body", 400)
    return web.json_response({"preflight": preflight.inspect(body.get("plan") or {}, body.get("request", ""))})


@routes.get("/superagent/workflow")
async def agent_get_workflow(request):
    workflow_id = request.query.get("id", "").strip()
    name = request.query.get("name", "").strip()
    workflow = catalog.get_workflow(workflow_id=workflow_id or None, name=name or None)
    target_path = workflow.get("path") if workflow else None

    if not target_path or not os.path.isfile(target_path):
        return _err(f"Workflow '{workflow_id or name}' not found or ambiguous.", 404)

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
    system_prompt += (
        "\n\nEXECUTION TRUTH RULE: Never claim that ComfyUI is processing, queued, completed, or rendered an image/video. "
        "Only the controller can report execution state, based on ComfyUI events and returned output files. "
        "When a generation action is needed, emit the supported action tag and stop; do not simulate progress messages. "
        "Routine, nonsexual edits such as changing the color of ordinary clothing are allowed image-edit requests. "
        "Do not invent a safety concern unless the actual request or image gives a concrete reason."
    )

    # Append available workflows list to context
    wfs = [f"{item['name']} [{item['id']}]" for item in catalog.list_workflows()]
    if wfs:
        system_prompt += f"\n\n--- AVAILABLE WORKFLOW TEMPLATES ON SYSTEM ---\n{', '.join(wfs)}\n---------------------------------------------"

    workflow_context = body.get("workflow_context")
    if workflow_context:
        system_prompt += f"\n\n--- ACTIVE COMFYUI CANVAS WORKFLOW ---\n{workflow_context}\n---------------------------------------"

    plan = body.get("orchestration_plan") or {}
    if plan.get("status") == "ready":
        system_prompt += (
            "\n\n--- ORCHESTRATOR ROUTE (AUTHORITATIVE) ---\n"
            f"Selected skill: {plan.get('skill_name')} ({plan.get('task')}).\n"
            f"Selected visual ComfyUI workflow: {plan.get('workflow_name')} [{plan.get('workflow_id')}].\n"
            f"Why this route was selected: {plan.get('route_reason', '')}\n"
            "The controller will load this GUI graph onto the canvas before queuing. Do not select or substitute another workflow.\n"
            "This authoritative route overrides generic instructions to ask before generation. Do not ask a follow-up unless a required input is missing.\n"
            "If the user explicitly requests generation, produce exactly one action in this format: "
            f"<SUPERAGENT_ACTION>{{\"type\":\"{'edit_image' if plan.get('task') == 'image_edit' else 'run'}\",\"prompt\":\"complete positive prompt\",\"negative_prompt\":\"optional negative prompt\"}}</SUPERAGENT_ACTION>. "
            "Use valid JSON string escaping. No action is allowed for prompt-only, description, or analysis requests.\n"
            "------------------------------------------"
        )
        if plan.get("prompt_guidance"):
            system_prompt += "\n\n--- SELECTED WORKFLOW PROMPT GUIDANCE ---\n" + plan["prompt_guidance"] + "\n----------------------------------------"
    elif plan.get("status") in ("unavailable", "incompatible", "needs_choice"):
        system_prompt += (
            "\n\n--- ORCHESTRATOR ROUTE STATUS ---\n"
            f"{plan.get('message') or plan.get('status')}\n"
            "Do not emit any executable action tag and do not claim that generation was queued.\n"
            "--------------------------------"
        )
    elif plan.get("status") == "needs_input":
        system_prompt += f"\n\n--- ORCHESTRATOR NEEDS INPUT ---\n{plan.get('message')} Do not queue any workflow.\n--------------------------------"
    elif plan.get("status") == "active_canvas":
        system_prompt += (
            "\n\n--- USER SELECTED THE ACTIVE CANVAS ---\n"
            "The user explicitly asked to use/run the current canvas. The controller will execute it; do not claim progress or completion yourself.\n"
            "---------------------------------------"
        )

    raw_messages = body.get("messages", [])
    # Only attach pixels from the newest uploaded image set; prior messages remain text context.
    latest_attachment_index = next(
        (i for i in range(len(raw_messages) - 1, -1, -1)
         if raw_messages[i].get("role") == "user" and (raw_messages[i].get("attachments") or raw_messages[i].get("attachment"))),
        None,
    )
    has_attached_image = latest_attachment_index is not None
    if has_attached_image:
        system_prompt += (
            "\n\n--- CRITICAL INSTRUCTION FOR ATTACHED IMAGES ---\n"
            "One or more images are attached. Inspect them and use the user's requested edit as the primary instruction; do not invent an unrelated scene or replace the request with a generic description.\n"
            "DO NOT repeat, echo, or output the 'Previous Canvas Positive Prompt' from the ACTIVE COMFYUI CANVAS WORKFLOW above, as that is an old prompt from a past run.\n"
            "Write a direct, concrete generation prompt describing only the requested change and the visual details needed to carry it out. Preserve unrelated image content.\n"
            "If the latest user request explicitly asks to edit/transform this uploaded image and generate the result, "
            "return one executable action using the action type and JSON format specified by the authoritative route above. "
            "The prompt value must be valid JSON string content, describe the requested edit while preserving unrelated image content, "
            "and contain no markdown fences. Do not emit this action for description or prompt-writing requests.\n"
            "------------------------------------------------"
        )

    formatted_messages = [{"role": "system", "content": system_prompt}]
    provider = llm.get_provider(cfg)

    for message_index, msg in enumerate(raw_messages):
        role = msg.get("role", "user")
        content = msg.get("content", "")
        attachments = []
        if message_index == latest_attachment_index:
            attachments = msg.get("attachments") or ([msg.get("attachment")] if msg.get("attachment") else [])
        if not attachments and message_index == latest_attachment_index and isinstance(content, str):
            m = re.search(r"\[Attached Image:\s*([^\]]+)\]", content)
            if m:
                attachments = [{"name": m.group(1).strip()}]

        image_payloads = []
        if role == "user":
            for attachment in attachments:
                if not isinstance(attachment, dict) or not attachment.get("name"):
                    continue
                img_path = _find_image_path(attachment.get("name"), attachment.get("subfolder", ""))
                mime, b64 = _get_image_base64(img_path) if img_path else (None, None)
                if b64:
                    image_payloads.append((mime, b64))
        if image_payloads:
            if provider == "ollama":
                formatted_messages.append({"role": "user", "content": content, "images": [b64 for _, b64 in image_payloads]})
            else:
                content_parts = [{"type": "text", "text": content}]
                content_parts.extend({"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}} for mime, b64 in image_payloads)
                formatted_messages.append({"role": "user", "content": content_parts})
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

