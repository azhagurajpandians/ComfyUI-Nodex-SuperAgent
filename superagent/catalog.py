"""Workflow and skill catalog for the Nodex orchestrator.

Workflow JSON is treated as data. Only ComfyUI GUI graphs are exposed to the
panel, and clients address them by catalog ID rather than by a filesystem path.
"""

import json
import os
import re


_PLUGIN_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_COMFY_ROOT = os.path.dirname(os.path.dirname(_PLUGIN_ROOT))
_BUNDLED_WORKFLOWS = os.path.join(_PLUGIN_ROOT, "workflows")
_SKILLS_PATH = os.path.join(os.path.dirname(__file__), "skills.json")


def _user_workflow_roots():
    user_root = None
    try:
        import folder_paths

        get_user_directory = getattr(folder_paths, "get_user_directory", None)
        if get_user_directory:
            user_root = get_user_directory()
    except Exception:
        pass
    if not user_root:
        user_root = os.path.join(_COMFY_ROOT, "user")

    roots = []
    if os.path.isdir(user_root):
        try:
            for profile in os.scandir(user_root):
                workflow_dir = os.path.join(profile.path, "workflows")
                if profile.is_dir() and os.path.isdir(workflow_dir):
                    roots.append((workflow_dir, f"user:{profile.name}/workflows"))
        except OSError:
            pass
    return roots


def _graph_metadata(data):
    nodes = data.get("nodes")
    if not isinstance(nodes, list) or not isinstance(data.get("links"), list):
        return None
    # GUI workflows can place executable nodes inside subgraphs. Include those
    # definitions when resolving model files and validating routed node types.
    all_nodes = list(nodes)
    definitions = data.get("definitions") or {}
    for subgraph in definitions.get("subgraphs", []) if isinstance(definitions, dict) else []:
        if isinstance(subgraph, dict) and isinstance(subgraph.get("nodes"), list):
            all_nodes.extend(subgraph["nodes"])
    node_types = sorted({str(n.get("type", "")) for n in all_nodes if isinstance(n, dict) and n.get("type")})
    node_names = sorted({str(n.get("title", "")) for n in all_nodes if isinstance(n, dict) and n.get("title")})
    node_ids = sorted(str(n.get("id")) for n in all_nodes if isinstance(n, dict) and n.get("id") is not None)
    type_text = " ".join(node_types).lower()
    has_video = any(token in type_text for token in ("video", "ltx", "wan", "hunyuan"))
    has_image_output = any("saveimage" in t.lower() for t in node_types)
    if has_video:
        modality = "video"
    elif has_image_output:
        modality = "image"
    else:
        modality = "unknown"
    models = []
    resolution = None
    for node in all_nodes:
        if not isinstance(node, dict):
            continue
        node_type = str(node.get("type", "")).lower()
        if node_type in ("emptylatentimage", "emptysd3latentimage"):
            values = node.get("widgets_values") or []
            if isinstance(values, list) and len(values) >= 2:
                try:
                    width, height = int(values[0]), int(values[1])
                    if width > 0 and height > 0:
                        resolution = {"width": width, "height": height}
                except (TypeError, ValueError):
                    pass
        elif node_type == "imagescale":
            values = node.get("widgets_values") or []
            if isinstance(values, list) and len(values) >= 3:
                try:
                    width, height = int(values[1]), int(values[2])
                    if width > 0 and height > 0:
                        resolution = {"width": width, "height": height}
                except (TypeError, ValueError):
                    pass
        if any(key in node_type for key in ("loader", "checkpoint", "lora")):
            values = node.get("widgets_values_named") or node.get("widgets_values") or {}
            if isinstance(values, dict):
                models.extend(str(v) for v in values.values() if isinstance(v, str) and v.lower().endswith((".safetensors", ".gguf", ".ckpt", ".pth")))
            elif isinstance(values, list):
                models.extend(v for v in values if isinstance(v, str) and v.lower().endswith((".safetensors", ".gguf", ".ckpt", ".pth")))
    return {
        "node_count": len(nodes),
        "node_types": node_types,
        "node_names": node_names,
        "node_ids": node_ids,
        "modality": modality,
        "has_image_input": any(t.lower() == "loadimage" for t in node_types),
        "has_model_only_lora": any(t.lower() == "loraloadermodelonly" for t in node_types),
        "models": sorted(set(models)),
        "resolution": resolution,
    }


def _workflow_roots():
    roots = [(_BUNDLED_WORKFLOWS, "bundle")]
    roots.extend(_user_workflow_roots())
    comfy_workflows = os.path.join(_COMFY_ROOT, "workflows")
    if os.path.isdir(comfy_workflows):
        roots.append((comfy_workflows, "comfy:workflows"))
    return roots


def list_workflows():
    found = []
    seen_paths = set()
    for root, source in _workflow_roots():
        if not os.path.isdir(root):
            continue
        for current, dirs, files in os.walk(root):
            dirs[:] = [d for d in dirs if not d.startswith(".") and d != "__pycache__"]
            for filename in sorted(files):
                if not filename.lower().endswith(".json"):
                    continue
                path = os.path.abspath(os.path.join(current, filename))
                if path in seen_paths:
                    continue
                seen_paths.add(path)
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                except (OSError, json.JSONDecodeError):
                    continue
                metadata = _graph_metadata(data) if isinstance(data, dict) else None
                if metadata is None:
                    continue
                rel = os.path.relpath(path, root).replace("\\", "/")
                workflow_id = f"{source}:{rel[:-5]}" if rel.lower().endswith(".json") else f"{source}:{rel}"
                found.append({
                    "id": workflow_id,
                    "name": os.path.splitext(os.path.basename(filename))[0],
                    "source": source,
                    "path": path,
                    **metadata,
                })
    return found


def get_workflow(workflow_id=None, name=None):
    entries = list_workflows()
    if workflow_id:
        return next((item for item in entries if item["id"] == workflow_id), None)
    if not name:
        return None
    target = _normalize(name)
    matches = [item for item in entries if _normalize(item["name"]) == target]
    if not matches:
        # Preserve old loose lookup only when the match is unique.
        matches = [item for item in entries if target in _normalize(item["name"]) or _normalize(item["name"]) in target]
    return matches[0] if len(matches) == 1 else None


def _normalize(value):
    return re.sub(r"[^a-z0-9]+", "", str(value).lower())


def list_skills():
    workflows = {item["id"]: item for item in list_workflows()}
    by_name = {_normalize(item["name"]): item for item in workflows.values()}
    try:
        with open(_SKILLS_PATH, "r", encoding="utf-8") as f:
            definitions = json.load(f)
    except (OSError, json.JSONDecodeError):
        definitions = []

    skills = []
    for definition in definitions:
        workflow = workflows.get(definition.get("workflow_id"))
        if workflow is None and definition.get("workflow_name"):
            workflow = by_name.get(_normalize(definition["workflow_name"]))
        if workflow is None and definition.get("workflow_pattern"):
            pattern = re.compile(definition["workflow_pattern"], re.IGNORECASE)
            workflow = next((
                item for item in workflows.values()
                # Model-family skills must only bind to a graph whose filename,
                # node types, or loader model values identify that family. Avoid
                # arbitrary bundled workflows and display titles that mention it.
                if (item["source"].startswith("user:") or item["source"] == "comfy:workflows")
                and pattern.search(" ".join([item["name"], *item.get("node_types", []), *item.get("models", [])]))
            ), None)
        skill = {k: v for k, v in definition.items() if k not in ("workflow_id", "workflow_name", "workflow_pattern")}
        skill["available"] = workflow is not None
        skill["workflow_id"] = workflow["id"] if workflow else None
        skill["workflow_name"] = workflow["name"] if workflow else None
        skill["reason"] = None if workflow else "No matching ComfyUI workflow is installed."
        if workflow:
            skill["modality"] = workflow["modality"]
            skill["models"] = workflow["models"]
            skill["node_count"] = workflow["node_count"]
        skills.append(skill)
    return skills

