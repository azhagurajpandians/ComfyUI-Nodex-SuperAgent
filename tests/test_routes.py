import unittest
from unittest.mock import MagicMock
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Mock ComfyUI PromptServer
if "server" not in sys.modules:
    mock_server = MagicMock()
    mock_prompt_server = MagicMock()
    mock_routes = MagicMock()
    mock_prompt_server.routes = mock_routes
    mock_server.PromptServer.instance = mock_prompt_server
    sys.modules["server"] = mock_server

from superagent import catalog, orchestrator, preflight, registry, routes


class TestRoutes(unittest.TestCase):
    def test_routes_registered(self):
        self.assertIsNotNone(routes)
        self.assertTrue(hasattr(routes, "agent_models"))
        self.assertTrue(hasattr(routes, "agent_chat"))
        self.assertTrue(hasattr(routes, "agent_unload"))
        self.assertTrue(hasattr(routes, "agent_get_config"))
        self.assertTrue(hasattr(routes, "agent_save_config"))
        self.assertTrue(hasattr(routes, "agent_list_workflows"))
        self.assertTrue(hasattr(routes, "agent_get_workflow"))
        self.assertTrue(hasattr(routes, "agent_plan"))
        self.assertTrue(hasattr(routes, "agent_preflight"))

    def test_public_config_never_exposes_api_key(self):
        public = routes._public_config({"provider": "openai", "api_key": "do-not-return"})
        self.assertEqual(public["api_key"], "********")
        self.assertNotIn("do-not-return", str(public))

    def test_image_path_rejects_parent_traversal_fallback(self):
        self.assertIsNone(routes._find_image_path("..\\..\\secret.png"))

    def test_catalog_includes_visual_user_workflows(self):
        workflow_ids = {item["id"] for item in catalog.list_workflows()}
        self.assertIn("bundle:template_krea2_t2i", workflow_ids)
        self.assertIn("user:default/workflows:video_ltx2_3_t2v", workflow_ids)

    def test_skill_registry_validates_saved_graph_bindings(self):
        skills = {skill["id"]: skill for skill in registry.list_skills()}
        for skill_id in ("krea2_t2i", "krea2_landscape", "krea2_i2i", "qwen_character_reference", "ltx_t2v", "ltx_i2v"):
            self.assertTrue(skills[skill_id]["available"], skills[skill_id]["registry_errors"])
            self.assertTrue(skills[skill_id]["workflow_validated"], skills[skill_id]["registry_errors"])
        self.assertIn("prompt", skills["krea2_t2i"]["required_inputs"])
        self.assertIn("image", skills["krea2_i2i"]["required_inputs"])
        self.assertTrue(skills["krea2_i2i"]["lora_required"])
        self.assertTrue(skills["krea2_i2i"]["workflow_validated"], skills["krea2_i2i"]["registry_errors"])

    def test_plan_routes_explicit_krea_landscape_to_visual_template(self):
        plan = orchestrator.plan_request("Create a Himalayan landscape in Krea 2")
        self.assertEqual(plan["status"], "ready")
        self.assertEqual(plan["workflow_id"], "bundle:template_krea2_landscape_16x9")
        self.assertIn("landscape framing", plan["route_reason"])
        self.assertTrue(any(candidate["selected"] for candidate in plan["candidates"]))

    def test_unmentioned_request_uses_ranked_default_skill_without_active_canvas_fallback(self):
        plan = orchestrator.plan_request("Generate an image of a red kite above a lake")
        self.assertEqual(plan["status"], "ready")
        self.assertEqual(plan["skill_id"], "krea2_t2i")
        self.assertTrue(plan["workflow_validated"])

    def test_common_generate_typo_still_routes_to_default_image_skill(self):
        plan = orchestrator.plan_request("generatea image of a natural ocean and beach")
        self.assertEqual(plan["status"], "ready")
        self.assertEqual(plan["skill_id"], "krea2_t2i")

    def test_regenerate_with_ratio_uses_matching_krea_graph(self):
        plan = orchestrator.plan_request(
            "set the resolution to 16:9 ratio and re gnerate the image",
            active_workflow="bundle:template_krea2_t2i",
        )
        self.assertEqual(plan["status"], "ready")
        self.assertEqual(plan["skill_id"], "krea2_t2i")

    def test_use_active_workflow_is_an_explicit_canvas_run_request(self):
        plan = orchestrator.plan_request("use the active workflow")
        self.assertEqual(plan["status"], "active_canvas")

    def test_resolution_only_request_updates_active_canvas_without_routing_generation(self):
        plan = orchestrator.plan_request("change the resolution to HD", active_workflow="bundle:template_krea2_i2i")
        self.assertEqual(plan["status"], "canvas_settings")
        self.assertEqual(plan["target"], "active_canvas")

    def test_plan_routes_ltx_video_and_never_falls_back_for_unavailable_models(self):
        ltx_plan = orchestrator.plan_request("Generate a video with LTX")
        self.assertEqual(ltx_plan["status"], "ready")
        self.assertEqual(ltx_plan["workflow_id"], "user:default/workflows:video_ltx2_3_t2v")

        minimax_plan = orchestrator.plan_request("Generate a video with MiniMax")
        self.assertEqual(minimax_plan["status"], "unavailable")
        self.assertIsNone(minimax_plan.get("workflow_id"))

    def test_qwen_edit_does_not_misroute_to_character_reference_workflow(self):
        plan = orchestrator.plan_request("Edit this image with Qwen Image Edit", has_image=True)
        self.assertEqual(plan["status"], "ready")
        self.assertEqual(plan["skill_id"], "qwen_image_edit")
        self.assertEqual(plan["max_images"], 10)
        self.assertEqual(len(plan["image_selectors"]), 10)

    def test_krea_identity_edit_uses_native_identity_graph_with_two_image_slots(self):
        plan = orchestrator.plan_request("Edit this image with Krea Identity Edit", has_image=True)
        self.assertEqual(plan["status"], "ready")
        self.assertEqual(plan["workflow_name"], "template_krea2_identity_edit")
        self.assertEqual(plan["max_images"], 2)
        self.assertEqual(len(plan["image_selectors"]), 2)

    def test_qwen_character_reference_is_not_claimed_as_edit(self):
        plan = orchestrator.plan_request("Create a character sheet with Qwen Image", has_image=True)
        self.assertEqual(plan["status"], "ready")
        self.assertEqual(plan["skill_id"], "qwen_character_reference")
        self.assertEqual(plan["task"], "image_with_references")

    def test_ltx_image_to_video_uses_visual_i2v_graph_and_requires_image(self):
        plan = orchestrator.plan_request("Make a video with LTX", has_image=True)
        self.assertEqual(plan["status"], "ready")
        self.assertEqual(plan["workflow_id"], "user:default/workflows:LTX_I2V_NODEX")

        missing_input = orchestrator.plan_request("Make an LTX I2V video")
        self.assertEqual(missing_input["status"], "needs_input")

    def test_krea_edit_requires_source_image(self):
        plan = orchestrator.plan_request("Edit this image with Krea 2")
        self.assertEqual(plan["status"], "needs_input")
        self.assertEqual(plan["skill_id"], "krea2_i2i")

    def test_natural_language_change_request_routes_as_image_edit(self):
        with_image = orchestrator.plan_request("chage the thsirt color to white", has_image=True)
        self.assertEqual(with_image["intent"], "image_edit")
        self.assertEqual(with_image["status"], "ready")
        self.assertEqual(with_image["skill_id"], "krea2_i2i")

        without_image = orchestrator.plan_request("chage the thsirt color to white")
        self.assertEqual(without_image["intent"], "image_edit")
        self.assertEqual(without_image["status"], "needs_input")

    def test_pose_or_scene_followup_with_image_routes_to_edit(self):
        plan = orchestrator.plan_request("make him sit in the Himalayas", has_image=True)
        self.assertEqual(plan["intent"], "image_edit")
        self.assertEqual(plan["skill_id"], "krea2_i2i")

    def test_preflight_reports_workflow_dimensions_and_machine_state(self):
        plan = orchestrator.plan_request("Create a landscape in Krea 2")
        report = preflight.inspect(plan, "Create a landscape in Krea 2")
        self.assertIn(report["status"], ("ready", "warning"))
        self.assertEqual(report["resolution"]["width"], 1024)
        self.assertEqual(report["resolution"]["height"], 576)
        self.assertIn("Krea 2 Turbo", report["mode"])
        self.assertIn("cuda_available", report["machine"])

    def test_preflight_honors_explicit_dimensions_for_image_workflows(self):
        plan = orchestrator.plan_request("Create a landscape in Krea 2")
        report = preflight.inspect(plan, "Create a landscape in Krea 2 at 768x512")
        self.assertEqual(report["resolution"]["width"], 768)
        self.assertEqual(report["resolution"]["height"], 512)
        self.assertTrue(report["resolution"]["apply"])

    def test_preflight_recommends_hd_resolution(self):
        plan = orchestrator.plan_request("Regenerate the Krea image at HD", active_workflow="bundle:template_krea2_t2i")
        report = preflight.inspect(plan, "Regenerate the Krea image at HD")
        self.assertEqual(report["resolution"]["width"], 1280)
        self.assertEqual(report["resolution"]["height"], 720)


if __name__ == "__main__":
    unittest.main()

