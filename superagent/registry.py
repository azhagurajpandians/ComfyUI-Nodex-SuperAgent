"""Validated, declarative skill registry layered over saved ComfyUI graphs.

skills.json is the authoring format; this module resolves each definition to a
cataloged workflow and checks that declared node bindings exist before routing.
"""

from . import catalog


def _selector_exists(selector, workflow):
    if not selector:
        return True
    if selector.get("node_id") is not None and str(selector["node_id"]) not in workflow.get("node_ids", []):
        return False
    if selector.get("node_type") and selector["node_type"] not in workflow.get("node_types", []):
        return False
    if selector.get("node_title") and selector["node_title"].lower() not in {name.lower() for name in workflow.get("node_names", [])}:
        return False
    return True


def list_skills():
    """Return skill definitions enriched with validation and workflow metadata."""
    workflows = {item["id"]: item for item in catalog.list_workflows()}
    result = []
    for skill in catalog.list_skills():
        workflow = workflows.get(skill.get("workflow_id"))
        errors = []
        if not skill.get("id") or not skill.get("name") or not skill.get("task"):
            errors.append("Skill must define id, name, and task.")
        if not skill.get("aliases"):
            errors.append("Skill needs at least one routing alias.")
        if workflow:
            if not _selector_exists(skill.get("prompt_selector"), workflow):
                errors.append("Prompt input selector does not match a node in its workflow.")
            if not _selector_exists(skill.get("image_selector"), workflow):
                errors.append("Image input selector does not match a node in its workflow.")
            for selector in skill.get("image_selectors", []):
                if not _selector_exists(selector, workflow):
                    errors.append("An image input selector does not match a node in its workflow.")
            if skill.get("lora_required") and not workflow.get("has_model_only_lora"):
                errors.append("Required model-only LoRA selector does not exist in its workflow.")
            if skill.get("task") in ("text_to_video", "image_to_video", "video_edit") and workflow.get("modality") != "video":
                errors.append("Video skill is bound to a non-video workflow graph.")
        skill["workflow_validated"] = workflow is not None and not errors
        skill["registry_errors"] = errors
        skill["required_inputs"] = [
            name for name, selector in (
                ("prompt", skill.get("prompt_selector")),
                ("image", skill.get("image_selector")),
                ("video", {"required": True} if skill.get("requires_video_upload") else None),
            ) if selector
        ]
        skill["required_model_files"] = list(skill.get("models", []))
        skill["capabilities"] = skill.get("capabilities") or [skill.get("task")]
        skill["settings"] = skill.get("settings") or {"mode": skill.get("mode_recommendation")}
        if errors:
            skill["available"] = False
            skill["reason"] = " ".join(errors)
        result.append(skill)
    return result


def get_skill(skill_id):
    return next((skill for skill in list_skills() if skill.get("id") == skill_id), None)

