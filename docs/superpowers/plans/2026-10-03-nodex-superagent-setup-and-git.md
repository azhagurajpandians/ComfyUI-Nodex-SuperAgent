# ComfyUI-Nodex-SuperAgent Phase 1 Structure & Git Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the ComfyUI-Nodex-SuperAgent custom node files to match the architectural layout specified in README.md, clean stray export folders, verify module loading and test contracts, and initialize a clean Git repository ready for GitHub publishing.

**Architecture:** The project acts as a ComfyUI custom node that exposes asynchronous HTTP endpoints (`/superagent/*`) via ComfyUI's internal PromptServer and a floating web chat panel in Vanilla JS served from `./web`. Python backend modules are organized into the `superagent` package, while web assets reside in `web/`.

**Tech Stack:** Python 3.10+, ComfyUI custom node API (`server.PromptServer`, `aiohttp`), Vanilla JavaScript (ES modules), Ollama HTTP API, Git.

**Spec:** [README.md](file:///e:/ComfyUI_windows_portable/ComfyUI/custom_nodes/ComfyUI-Nodex-SuperAgent/README.md)

## Global Constraints

- Keep changes direct and minimal; do not introduce external Python dependencies beyond `aiohttp` (shipped with ComfyUI).
- Ensure `WEB_DIRECTORY = "./web"` correctly maps to frontend assets.
- Preserve relative path resolution in `superagent/config.py` pointing to `config.json` at root.
- Ensure strict compliance with ComfyUI extension specifications (`NODE_CLASS_MAPPINGS`, `WEB_DIRECTORY`).

---

### Task 1: Restructure Files into `superagent/` and `web/` Directories

**Files:**
- Create: `superagent/__init__.py`
- Move: `config.py` -> `superagent/config.py`
- Move: `llm.py` -> `superagent/llm.py`
- Move: `routes.py` -> `superagent/routes.py`
- Move: `superagent_panel.js` -> `web/superagent_panel.js`
- Delete: `mnt/` recursive directory

**Interfaces:**
- Consumes: Root `config.json`, ComfyUI `PromptServer`
- Produces: `superagent` package with `routes`, `config`, `llm` submodules; `web/superagent_panel.js` web entry point

- [ ] **Step 1: Create directories `superagent` and `web`**
  Ensure directories `superagent` and `web` are created.

- [ ] **Step 2: Move backend files into `superagent/` and web asset into `web/`**
  Move `config.py`, `llm.py`, `routes.py` into `superagent/`. Move `superagent_panel.js` into `web/`. Create an empty `superagent/__init__.py`.

- [ ] **Step 3: Remove stray `mnt/` folder**
  Delete the temporary/accidental `mnt/` directory and all its contents.

- [ ] **Step 4: Verify module import via Python**
  Run: `python -c "import __init__; print('__init__ ok, web dir:', __init__.WEB_DIRECTORY)"`
  Expected: Successful import without `ModuleNotFoundError`.

---

### Task 2: Backend Verification & Unit Tests

**Files:**
- Create: `tests/test_config.py`
- Create: `tests/test_routes.py`
- Modify: None

**Interfaces:**
- Consumes: `superagent.config.load`, `superagent.llm`, `superagent.routes`
- Produces: Pytest / unittest test suite verifying config resolution and error handling

- [ ] **Step 1: Write test for config loader**
  Create `tests/test_config.py` to verify that `superagent.config.load()` successfully finds root `config.json` and loads defaults if keys are missing.

```python
import os
import unittest
from superagent import config

class TestConfig(unittest.TestCase):
    def test_load_config(self):
        cfg = config.load()
        self.assertIn("ollama_host", cfg)
        self.assertIn("default_model", cfg)
        self.assertIn("keep_alive", cfg)

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify config loading passes**
  Run: `python -m unittest tests/test_config.py`
  Expected: OK

- [ ] **Step 3: Write test for endpoint imports and mock server registration**
  Create `tests/test_routes.py` ensuring routes register cleanly on ComfyUI's PromptServer routes dictionary.

```python
import unittest
from unittest.mock import MagicMock
import sys

# Mock server.PromptServer if not in full comfy execution
if "server" not in sys.modules:
    mock_server = MagicMock()
    mock_server.PromptServer.instance.routes = MagicMock()
    sys.modules["server"] = mock_server

from superagent import routes

class TestRoutes(unittest.TestCase):
    def test_routes_imported(self):
        self.assertIsNotNone(routes)

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 4: Run test to verify routes pass**
  Run: `python -m unittest tests/test_routes.py`
  Expected: OK

---

### Task 3: Update README and Documentation

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: User documentation
- Produces: Accurate model guidance and git installation steps

- [ ] **Step 1: Add git clone instructions to README.md**
  Add `git clone https://github.com/<username>/ComfyUI-Nodex-SuperAgent.git` under Install section.

- [ ] **Step 2: Add common Ollama model examples**
  Update model examples to include standard available models (e.g., `qwen2.5:14b`, `llama3.1:8b`).

- [ ] **Step 3: Document zero keep_alive for low-VRAM GPUs**
  Mention `"keep_alive": 0` in the Configuration / Hardware table for auto-unloading immediately after generation.

---

### Task 4: Git Repository & GitHub Initialization

**Files:**
- Create: `.gitignore`

**Interfaces:**
- Consumes: Project files
- Produces: Clean Git repository with `main` branch and initial commit

- [ ] **Step 1: Create `.gitignore`**
  Create `.gitignore` containing:
```gitignore
__pycache__/
*.py[cod]
*$py.class
.pytest_cache/
.DS_Store
mnt/
docs/superpowers/
```

- [ ] **Step 2: Initialize Git repository**
  Run: `git init -b main` in `ComfyUI-Nodex-SuperAgent`.

- [ ] **Step 3: Stage all files and create Initial Commit**
  Run:
```bash
git add .gitignore __init__.py config.json README.md superagent/ web/ tests/
git commit -m "feat: initial commit of ComfyUI-Nodex-SuperAgent"
```

- [ ] **Step 4: Configure GitHub Remote Origin**
  Run:
```bash
git remote add origin https://github.com/dreamsin3d/ComfyUI-Nodex-SuperAgent.git
```
  Provide instructions for pushing to GitHub once remote repository is created on github.com.
