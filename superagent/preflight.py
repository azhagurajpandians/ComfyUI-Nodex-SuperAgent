"""Conservative workflow and machine preflight recommendations."""

import os
import re

from . import catalog


_MODEL_TYPES = ("checkpoints", "diffusion_models", "unet", "loras", "vae", "text_encoders", "clip", "upscale_models")


def _machine_info():
    info = {"cuda_available": False, "gpu": None, "vram_total_gb": None, "vram_free_gb": None, "ram_total_gb": None}
    try:
        import torch

        info["cuda_available"] = bool(torch.cuda.is_available())
        if info["cuda_available"]:
            info["gpu"] = torch.cuda.get_device_name(0)
            free, total = torch.cuda.mem_get_info(0)
            info["vram_total_gb"] = round(total / (1024 ** 3), 1)
            info["vram_free_gb"] = round(free / (1024 ** 3), 1)
    except Exception:
        pass
    try:
        import psutil

        info["ram_total_gb"] = round(psutil.virtual_memory().total / (1024 ** 3), 1)
    except Exception:
        pass
    return info


def _model_inventory():
    inventory = {}
    try:
        import folder_paths

        for category in _MODEL_TYPES:
            try:
                inventory[category] = sorted(set(folder_paths.get_filename_list(category)))
            except Exception:
                inventory[category] = []
    except Exception:
        return None
    return inventory


def _resolution_for(skill, task, request):
    requested = (request or "").lower()
    dimensions = re.search(r"\b(\d{3,4})\s*[x×]\s*(\d{3,4})\b", requested)
    if dimensions:
        return {"width": int(dimensions.group(1)), "height": int(dimensions.group(2)), "reason": "Uses the dimensions requested by the user.", "apply": task in ("text_to_image", "image_edit", "image_with_references")}
    if re.search(r"\b(?:full\s*hd|1080p)\b", requested):
        return {"width": 1920, "height": 1080, "reason": "Uses the requested Full HD landscape dimensions.", "apply": task in ("text_to_image", "image_edit", "image_with_references")}
    if re.search(r"\b(?:hd|720p)\b", requested):
        return {"width": 1280, "height": 720, "reason": "Uses the requested HD landscape dimensions.", "apply": task in ("text_to_image", "image_edit", "image_with_references")}
    if any(x in requested for x in ("9:16", "portrait", "vertical")):
        return {"width": 576, "height": 1024, "reason": "Matches the requested portrait framing.", "apply": task in ("text_to_image", "image_edit", "image_with_references")}
    if any(x in requested for x in ("16:9", "landscape", "widescreen", "wide")):
        return {"width": 1024, "height": 576, "reason": "Matches the requested landscape framing.", "apply": task in ("text_to_image", "image_edit", "image_with_references")}
    if any(x in requested for x in ("1:1", "square")):
        return {"width": 1024, "height": 1024, "reason": "Matches the requested square framing.", "apply": task in ("text_to_image", "image_edit", "image_with_references")}
    preset = skill.get("resolution") or {}
    if preset.get("width") and preset.get("height"):
        return {**preset, "reason": preset.get("reason", "Uses the workflow's registered default.")}
    if task in ("text_to_video", "image_to_video"):
        return {"width": 768, "height": 512, "reason": "Conservative starting size for video generation; confirm the workflow supports these dimensions."}
    return {"width": 1024, "height": 1024, "reason": "Conservative square starting point; adjust to the workflow's supported sizes."}


def inspect(plan, request=""):
    """Return machine facts and workflow-specific recommendations without queueing."""
    if not plan or plan.get("status") != "ready":
        return {"status": "not_ready", "message": "Select an available workflow before preflight."}
    skill = next((s for s in catalog.list_skills() if s.get("id") == plan.get("skill_id")), {})
    workflow = catalog.get_workflow(workflow_id=plan.get("workflow_id")) or {}
    machine = _machine_info()
    inventory = _model_inventory()
    workflow_models = plan.get("models") or []
    installed = set()
    if inventory is not None:
        installed = {os.path.basename(name).lower() for names in inventory.values() for name in names}
    missing = [name for name in workflow_models if os.path.basename(name).lower() not in installed]
    available_loras = (inventory or {}).get("loras", [])
    identity_loras = sorted(name for name in available_loras if os.path.basename(name).lower().startswith("krea2_") and "realism" not in os.path.basename(name).lower())
    configured_lora = skill.get("lora_name")
    selected_lora = None
    if configured_lora:
        selected_lora = next((name for name in available_loras if name.lower().replace("\\", "/") == configured_lora.lower().replace("\\", "/")), None)
    resolution = _resolution_for(skill, plan.get("task"), request)
    explicit_aspect = any(x in (request or "").lower() for x in ("9:16", "portrait", "vertical", "16:9", "landscape", "widescreen", "wide", "1:1", "square", " hd", "720p", "1080p"))
    if not explicit_aspect and workflow.get("resolution"):
        resolution = {**workflow["resolution"], "reason": "Read from the selected ComfyUI workflow's latent-size node.", "apply": False}
    elif resolution.get("apply") is None:
        resolution["apply"] = False
    warnings = []
    if missing:
        warnings.append("Workflow model files were not found in ComfyUI's indexed model folders: " + ", ".join(missing))
    if not machine["cuda_available"]:
        warnings.append("CUDA hardware was not detected. The selected workflow may be very slow or unsupported on CPU.")
    elif machine["vram_free_gb"] is not None and machine["vram_free_gb"] < 8:
        warnings.append("Less than 8 GB of free GPU memory is currently available; consider a smaller size or freeing VRAM.")
    return {
        "status": "warning" if warnings else "ready",
        "skill_id": plan.get("skill_id"),
        "skill_name": plan.get("skill_name"),
        "workflow_id": plan.get("workflow_id"),
        "workflow_name": plan.get("workflow_name"),
        "task": plan.get("task"),
        "models": workflow_models,
        "missing_models": missing,
        "machine": machine,
        "model_inventory": {key: len(value) for key, value in (inventory or {}).items()},
        "resolution": resolution,
        "resolution_in_workflow": workflow.get("resolution"),
        "identity_loras": identity_loras if plan.get("lora_required") and not configured_lora else [],
        "selected_lora": selected_lora,
        "mode": skill.get("mode_recommendation", "Use the mode encoded by the selected workflow graph."),
        "warnings": warnings,
        "can_proceed": not missing,
    }
