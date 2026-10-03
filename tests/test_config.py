import unittest
import os
import sys
import json

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

    def test_security_secrets_isolation(self):
        # Verify saving writes to config.local.json and never pollutes config.json
        original_local_content = None
        if os.path.exists(config._LOCAL_PATH):
            with open(config._LOCAL_PATH, "r", encoding="utf-8") as f:
                original_local_content = f.read()

        test_key = "nvapi-secret-test-key-12345"
        try:
            config.save({"api_key": test_key})
            # 1. config.local.json exists and contains the key
            self.assertTrue(os.path.isfile(config._LOCAL_PATH))
            with open(config._LOCAL_PATH, "r", encoding="utf-8") as f:
                local_data = json.load(f)
            self.assertEqual(local_data.get("api_key"), test_key)

            # 2. config.json (git-tracked) DOES NOT contain the key
            with open(config._PATH, "r", encoding="utf-8") as f:
                base_data = json.load(f)
            self.assertNotEqual(base_data.get("api_key"), test_key)

            # 3. config.load() correctly returns the key from local
            loaded = config.load()
            self.assertEqual(loaded.get("api_key"), test_key)
        finally:
            if original_local_content is not None:
                with open(config._LOCAL_PATH, "w", encoding="utf-8") as f:
                    f.write(original_local_content)
            elif os.path.exists(config._LOCAL_PATH):
                os.remove(config._LOCAL_PATH)


if __name__ == "__main__":
    unittest.main()
