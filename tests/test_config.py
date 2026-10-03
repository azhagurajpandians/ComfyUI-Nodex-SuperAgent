import unittest
import os
import sys

# Ensure custom node root is in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from superagent import config


class TestConfig(unittest.TestCase):
    def test_load_config_contains_keys(self):
        cfg = config.load()
        self.assertIsInstance(cfg, dict)
        self.assertIn("ollama_host", cfg)
        self.assertIn("default_model", cfg)
        self.assertIn("keep_alive", cfg)
        self.assertIn("num_ctx", cfg)
        self.assertIn("temperature", cfg)

    def test_config_json_path_resolved(self):
        self.assertTrue(os.path.isfile(config._PATH))


if __name__ == "__main__":
    unittest.main()
