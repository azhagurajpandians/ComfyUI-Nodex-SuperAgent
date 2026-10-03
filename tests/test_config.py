import unittest
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from superagent import config, llm


class TestConfig(unittest.TestCase):
    def test_load_config_contains_keys(self):
        cfg = config.load()
        self.assertIsInstance(cfg, dict)
        self.assertIn("provider", cfg)
        self.assertIn("ollama_host", cfg)
        self.assertIn("default_model", cfg)
        self.assertIn("keep_alive", cfg)
        self.assertIn("num_ctx", cfg)
        self.assertIn("temperature", cfg)

    def test_config_json_path_resolved(self):
        self.assertTrue(os.path.isfile(config._PATH))

    def test_provider_presets(self):
        self.assertIn("ollama", config.PROVIDER_PRESETS)
        self.assertIn("nvidia", config.PROVIDER_PRESETS)
        self.assertIn("openai", config.PROVIDER_PRESETS)
        self.assertIn("gemini", config.PROVIDER_PRESETS)
        self.assertIn("custom", config.PROVIDER_PRESETS)

    def test_llm_provider_helpers(self):
        cfg_nvidia = {"provider": "nvidia"}
        self.assertEqual(llm.get_provider(cfg_nvidia), "nvidia")
        self.assertEqual(llm.get_base_url(cfg_nvidia), "https://integrate.api.nvidia.com/v1")

        cfg_gemini = {"provider": "gemini"}
        self.assertEqual(llm.get_provider(cfg_gemini), "gemini")
        self.assertEqual(llm.get_base_url(cfg_gemini), "https://generativelanguage.googleapis.com/v1beta/openai")


if __name__ == "__main__":
    unittest.main()
