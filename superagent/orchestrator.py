"""Deterministic workflow routing and plan construction."""

import difflib
import re

from .registry import list_skills


_PROMPT_ONLY = re.compile(r"\b(prompt|describe|analy[sz]e|what is in|caption)\b", re.I)
_GENERATE = re.compile(r"\b(createa?|generatea?|gneratea?|re[\s-]*g(?:e)?nerate|regenerate|make|render|animate|edit|change|chage|replace|remove|restyle|inpaint|outpaint|transform|upscale|run)\b", re.I)
_VIDEO = re.compile(r"\b(video|clip|animation|animate|t2v|i2v)\b", re.I)
_IMAGE_EDIT = re.compile(r"\b(edit|change|chage|replace|remove|add|transform|inpaint|outpaint|restyle|move|put|place|position|sit|stand|turn)\b", re.I)
_GENERATION_ACTION = re.compile(r"\b(createa?|generatea?|gneratea?|gnerate|re[\s-]*g(?:e)?nerate|regenerate|render|animate|edit|inpaint|outpaint|restyle|transform|upscale)\b", re.I)
_SCENE_ACTION = re.compile(r"\b(sit|stand|pose|move|put|place|position|turn|wear|hold|watch(?:ing)?)\b", re.I)
_IMAGE_ENTITY = re.compile(r"\b(boy|girl|man|woman|person|subject|character|shirt|clothing|background|hair|face|object|scene|image|photo|picture|landscape|portrait)\b", re.I)
_MAKE_IMAGE = re.compile(r"\bmake\s+(?:(?:an?|the)\s+)?(?:image|picture|photo|scene|landscape|portrait|video)\b", re.I)
_WORD = re.compile(r"\b[A-Za-z][A-Za-z'-]*\b")
_COMMON_MISSPELLINGS = {
    "gneratea": "generate a", "gnerate": "generate", "generatea": "generate a",
    "createa": "create a", "creata": "create a", "chsange": "change", "chage": "change",
    "chnage": "change", "thsirt": "shirt", "thshirt": "shirt", "tshirt": "t-shirt",
    "reslotuion": "resolution", "resoltuion": "resolution", "reslotution": "resolution",
    "worklfow": "workflow", "wokflow": "workflow", "wrokflow": "workflow",
    "refrecene": "reference", "refernece": "reference", "uplad": "upload",
    "whte": "white", "colur": "color", "kread": "krea", "qween": "qwen",
}
_SPELLING_VOCABULARY = (
    "generate create image picture photo edit change replace remove add restyle inpaint outpaint transform upscale "
    "resolution landscape portrait reference workflow upload color colour shirt clothing background hair face quality "
    "cinematic natural ocean beach mountain video animation identity model sampler prompt white black red blue green"
).split()
_ACTIVE_RUN = re.compile(r"\b(?:run|queue|execute|use)\b.*\b(?:active|current)\b.*\b(?:canvas|workflow)\b", re.I)
_CANVAS_SETTING = re.compile(r"\b(?:resolution|resol(?:u?tio?n)?|aspect\s+ratio|ratio|size|hd|720p|1080p|full\s*hd)\b", re.I)
_SETTING_VERB = re.compile(r"\b(?:set|change|chnage|switch|adjust|update|make)\b", re.I)
_RUN_VERB = re.compile(r"\b(?:generate|create|render|regenerate|re\s+gnerate|queue|run|execute)\b", re.I)


def _norm(text):
    return re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).strip()


def normalize_request(text):
    """Repair obvious typos in routing vocabulary without rewriting names/details."""
    corrections = {}

    def fix_word(match):
        original = match.group(0)
        lower = original.lower()
        replacement = _COMMON_MISSPELLINGS.get(lower)
        if replacement is None and len(lower) >= 5:
            candidate = difflib.get_close_matches(lower, _SPELLING_VOCABULARY, n=1, cutoff=0.86)
            if candidate and candidate[0] != lower:
                replacement = candidate[0]
        if not replacement:
            return original
        if replacement.isalpha() and original[:1].isupper():
            replacement = replacement.capitalize()
        corrections.setdefault(lower, replacement)
        return replacement

    normalized = _WORD.sub(fix_word, str(text or ""))
    normalized, article_count = re.subn(r"\ba\s+(image|ocean|object|animal)\b", r"an \1", normalized, flags=re.I)
    if article_count:
        corrections.setdefault("a image", "an image")
    entries = [{"from": source, "to": target} for source, target in corrections.items()]
    return normalized, entries


def _contains_alias(text, alias):
    normalized = _norm(text)
    needle = _norm(alias)
    return bool(needle) and f" {needle} " in f" {normalized} "


def _candidate_summary(skills, text, intent, selected_id=None):
    ranked = []
    for skill in skills:
        task_match = skill.get("task") == intent
        aliases = [alias for alias in skill.get("aliases", []) if _contains_alias(text, alias)]
        alias = max(aliases, key=lambda value: len(_norm(value)), default=None)
        score = (60 if task_match else 0) + (min(len(_norm(alias)), 36) if alias else 0)
        if skill.get("default") and task_match:
            score += 8
        if skill.get("available") and task_match:
            score += 5
        if skill.get("requires_video_upload"):
            score -= 20
        ranked.append({
            "id": skill.get("id"), "name": skill.get("name"), "task": skill.get("task"),
            "score": score, "available": bool(skill.get("available")),
            "workflow_id": skill.get("workflow_id"), "matched_alias": alias,
            "selected": skill.get("id") == selected_id,
            "reason": skill.get("reason") or (f"Matches '{alias}' and supports {intent.replace('_', ' ')}." if alias and task_match else f"Supports {skill.get('task', 'unknown').replace('_', ' ')}."),
        })
    ranked.sort(key=lambda item: (item["score"], item["available"], item["id"] == selected_id), reverse=True)
    return ranked[:5]


def _image_input_message(skill):
    name = skill.get("name", "this workflow")
    if skill.get("id") == "krea2_i2i":
        return f"Attach the image you want to edit. For Krea Identity Edit, image 1 is the edit source; image 2 is an optional identity/person reference."
    if skill.get("id") == "qwen_image_edit":
        return f"Attach the image you want to edit. For Qwen Image Edit, put the source first, then add any reference images in order (up to {skill.get('max_images', 10)} images total)."
    max_images = skill.get("max_images") or len(skill.get("image_selectors", [])) or 1
    suffix = f" You can attach up to {max_images} images." if max_images > 1 else ""
    return f"Attach an image to use {name}.{suffix}"


def _intent(text, has_image=False, has_video=False):
    if _ACTIVE_RUN.search(text):
        return "run_current"
    if _PROMPT_ONLY.search(text) and not re.search(r"\b(generate|create|make|run|edit)\b", text, re.I):
        return "advice"
    if not _GENERATE.search(text):
        return "chat"
    if has_video or re.search(r"\b(edit|transform|restyle)\b.*\bvideo\b", text, re.I):
        return "video_edit"
    if _VIDEO.search(text):
        return "image_to_video" if has_image or re.search(r"\b(image|photo|picture|animate|i2v)\b", text, re.I) else "text_to_video"
    # An explicit edit verb plus a named image-edit model/tool is still an edit
    # request when the input image has not been attached yet. Keeping intent
    # classification independent of attachment lets the planner return
    # needs_input instead of accidentally choosing a text-to-image graph.
    if _IMAGE_EDIT.search(text) and (
        has_image or re.search(r"\b(image|photo|picture|reference|qwen|krea|t[\s-]?shirt|shirt|clothing|hair|background|colour|color|face|person|object)\b", text, re.I)
    ):
        return "image_edit"
    if has_image and re.search(r"\b(reference|based on|use this|use the image)\b", text, re.I):
        return "image_with_references"
    if has_image:
        return "image_with_references"
    return "text_to_image"


def _is_resolution_only_request(text):
    """Only short, settings-focused turns should bypass workflow routing."""
    if not (_CANVAS_SETTING.search(text) and _SETTING_VERB.search(text)):
        return False
    if _GENERATION_ACTION.search(text) or _MAKE_IMAGE.search(text):
        return False
    if _SCENE_ACTION.search(text) and _IMAGE_ENTITY.search(text):
        return False
    # A clothing/subject/background edit in the same turn as a resolution
    # request is still a generation task, while "change resolution to HD" is not.
    if _IMAGE_EDIT.search(text) and re.search(r"\b(?:shirt|clothing|background|hair|face|person|subject|object|image|photo|picture)\b", text, re.I):
        return False
    return True


def plan_request(text, has_image=False, has_video=False, active_workflow=None):
    original_text = str(text or "")
    text, normalizations = normalize_request(original_text)
    if _is_resolution_only_request(text):
        return {
            "status": "canvas_settings", "intent": "canvas_settings", "steps": [],
            "message": "Update the active canvas settings without loading or running a workflow.",
            "target": "active_canvas", "original_request": original_text,
            "normalized_request": text, "normalizations": normalizations,
        }
    intent = _intent(text, has_image=has_image, has_video=has_video)
    plan = {
        "status": "chat", "intent": intent, "steps": [], "message": None,
        "original_request": original_text, "normalized_request": text,
        "normalizations": normalizations,
    }
    if intent == "run_current":
        plan.update(status="active_canvas", message="The user explicitly requested the active canvas workflow.", route_reason="Explicit active-canvas instruction.")
        return plan
    if intent in ("chat", "advice"):
        return plan

    skills = list_skills()
    available = [skill for skill in skills if skill.get("available")]

    # Exact user-requested tool names take precedence over modality defaults.
    mentioned = []
    for skill in skills:
        aliases = sorted(skill.get("aliases", []), key=len, reverse=True)
        if any(_contains_alias(text, alias) for alias in aliases):
            mentioned.append(skill)
    if mentioned:
        # Prefer the longest matched phrase. If multiple skills share an alias,
        # choose the task-compatible one; never fall through to the active canvas.
        mentioned.sort(key=lambda s: max((len(_norm(a)) for a in s.get("aliases", []) if _contains_alias(text, a)), default=0), reverse=True)
        skill = next((s for s in mentioned if s.get("task") == intent), mentioned[0])
        # A model-family name (for example, "Krea 2") plus an image/edit intent
        # selects the matching edit skill even if the user did not say "Krea edit".
        if skill.get("task") != intent and skill.get("id", "").startswith("krea2_"):
            sibling = next((s for s in skills if s.get("id") == "krea2_i2i" and s.get("task") == intent), None)
            if sibling:
                skill = sibling
        if skill.get("task") != intent and skill.get("id", "").startswith("ltx_"):
            sibling = next((s for s in skills if s.get("id", "").startswith("ltx_") and s.get("task") == intent and s.get("available")), None)
            if sibling:
                skill = sibling
        # Aspect choices are part of routing, not prompt text.
        if not active_workflow and intent == "text_to_image" and any(_contains_alias(text, x) for x in ("landscape", "16:9", "widescreen")) and "krea" in _norm(text):
            skill = next((s for s in skills if s.get("id") == "krea2_landscape" and s.get("available")), skill)
        elif not active_workflow and intent == "text_to_image" and any(_contains_alias(text, x) for x in ("portrait", "9:16")) and "krea" in _norm(text):
            skill = next((s for s in skills if s.get("id") == "krea2_portrait" and s.get("available")), skill)
        if not skill.get("available"):
            plan.update(status="unavailable", skill_id=skill["id"], skill_name=skill["name"], message=f"{skill['name']} is not configured: {skill.get('reason')}", route_reason="The requested skill matched by name, but it is not runnable.", candidates=_candidate_summary(skills, text, intent, skill["id"]))
            return plan
        if skill.get("image_selector") and not has_image:
            plan.update(status="needs_input", skill_id=skill["id"], skill_name=skill["name"], message=_image_input_message(skill))
            return plan
        if skill.get("requires_video_upload"):
            plan.update(status="unavailable", skill_id=skill["id"], skill_name=skill["name"], message=f"{skill['name']} needs a video input. Video upload is not enabled in this panel yet.")
            return plan
        if skill.get("task") != intent:
            plan.update(status="incompatible", skill_id=skill["id"], skill_name=skill["name"], message=f"{skill['name']} handles {skill.get('task').replace('_', ' ')}, but this request needs {intent.replace('_', ' ')}.")
            return plan
        if has_image and skill.get("image_selector") is None and intent in ("image_edit", "image_with_references", "image_to_video"):
            plan.update(status="incompatible", skill_id=skill["id"], skill_name=skill["name"], message=f"{skill['name']} does not define an image input, so it cannot use the attached image.")
            return plan
        if intent in ("image_edit", "image_with_references", "image_to_video") and skill.get("image_selector") and not has_image:
            plan.update(status="needs_input", skill_id=skill["id"], skill_name=skill["name"], message=_image_input_message(skill))
            return plan
    else:
        candidates = [s for s in available if s.get("task") == intent]
        if active_workflow and intent in ("text_to_image", "image_edit", "text_to_video", "image_to_video"):
            active = next((s for s in candidates if s.get("workflow_id") == active_workflow), None)
            if active:
                skill = active
            else:
                skill = None
        else:
            # Rank only validated, installed workflows. A declared default is a
            # small tie-breaker; equal-ranked routes are shown to the user.
            ranked = _candidate_summary(candidates, text, intent)
            by_id = {candidate["id"]: candidate for candidate in candidates}
            top = ranked[0] if ranked else None
            next_score = ranked[1]["score"] if len(ranked) > 1 else None
            skill = by_id.get(top["id"]) if top and (next_score is None or top["score"] > next_score) else None
        if not skill:
            if candidates:
                ranked = _candidate_summary(candidates, text, intent)
                plan.update(status="needs_choice", choices=[{"id": item["id"], "name": item["name"], "score": item["score"], "reason": item["reason"]} for item in ranked], candidates=ranked, message="Several workflows can handle this. Choose one to run.")
            else:
                plan.update(status="unavailable", message=f"No installed workflow is registered for {intent.replace('_', ' ')}.")
            return plan

    # Apply input requirements after selection as well as during explicit-name
    # routing; generic edits must not bypass attachment checks.
    if skill.get("requires_video_upload") and not has_video:
        plan.update(status="unavailable", skill_id=skill["id"], skill_name=skill["name"], message=f"{skill['name']} needs a video input. Video upload is not enabled in this panel yet.")
        return plan
    if skill.get("image_selector") and not has_image and intent in ("image_edit", "image_with_references", "image_to_video"):
        plan.update(status="needs_input", skill_id=skill["id"], skill_name=skill["name"], message=_image_input_message(skill))
        return plan
    if has_image and not skill.get("image_selector") and intent in ("image_edit", "image_with_references", "image_to_video"):
        plan.update(status="incompatible", skill_id=skill["id"], skill_name=skill["name"], message=f"{skill['name']} does not define an image input, so it cannot use the attached image.")
        return plan

    reasons = []
    matched = [alias for alias in skill.get("aliases", []) if _contains_alias(text, alias)]
    if matched:
        reasons.append(f"Request explicitly matched the {max(matched, key=lambda value: len(_norm(value)))} skill alias.")
    elif skill.get("id") == "krea2_landscape":
        reasons.append("The request asked for landscape framing, so the matching Krea 16:9 graph was selected.")
    elif skill.get("id") == "krea2_portrait":
        reasons.append("The request asked for portrait framing, so the matching Krea 9:16 graph was selected.")
    reasons.append(f"The registered workflow supports {skill['task'].replace('_', ' ')}.")
    if skill.get("image_selector"):
        reasons.append("The workflow declares an image input and the request supplied one." if has_image else "The workflow declares an image input.")
    if skill.get("models"):
        reasons.append("The workflow metadata identifies its model files: " + ", ".join(skill["models"]) + ".")
    candidates = _candidate_summary(skills, text, intent, skill["id"])
    plan.update(
        status="ready",
        skill_id=skill["id"],
        skill_name=skill["name"],
        workflow_id=skill["workflow_id"],
        workflow_name=skill["workflow_name"],
        task=skill["task"],
        prompt_selector=skill.get("prompt_selector"),
        negative_prompt_selector=skill.get("negative_prompt_selector"),
        image_selector=skill.get("image_selector"),
        image_selectors=skill.get("image_selectors", []),
        max_images=skill.get("max_images"),
        detach_unused_image_inputs=skill.get("detach_unused_image_inputs", False),
        prompt_guidance=skill.get("prompt_guidance", ""),
        lora_selector=skill.get("lora_selector"),
        lora_required=skill.get("lora_required", False),
        lora_strength=skill.get("lora_strength", 1.0),
        requires_video_upload=skill.get("requires_video_upload", False),
        models=skill.get("models", []),
        required_inputs=skill.get("required_inputs", []),
        required_model_files=skill.get("required_model_files", []),
        workflow_validated=skill.get("workflow_validated", False),
        capabilities=skill.get("capabilities", [skill.get("task")]),
        settings=skill.get("settings", {}),
        route_reason=" ".join(reasons),
        candidates=candidates,
        steps=[
            {"tool": "load_workflow", "workflow_id": skill["workflow_id"]},
            {"tool": "set_inputs", "prompt_selector": skill.get("prompt_selector"), "image_selector": skill.get("image_selector"), "image_selectors": skill.get("image_selectors", [])},
            {"tool": "queue_workflow"},
            {"tool": "monitor_and_return_outputs"},
        ],
    )
    return plan

