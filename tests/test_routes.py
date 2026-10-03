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

from superagent import routes


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


if __name__ == "__main__":
    unittest.main()
