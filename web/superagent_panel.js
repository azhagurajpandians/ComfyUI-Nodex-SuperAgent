import { app } from "../../scripts/app.js";

const STORE = "nodex_superagent_ui";
const DOCK_LEFT = 56; // px: clears ComfyUI's left sidebar icon bar
const DOCK_TOP = 48; // px: clears ComfyUI's top bar

const PROVIDER_INFO = {
  ollama: {
    name: "Ollama (Local)",
    default_url: "http://127.0.0.1:11434",
    default_model: "llama3.1:8b",
    hint: "Runs locally on your machine via Ollama. Host default: http://127.0.0.1:11434.",
    key_placeholder: "Optional / Not required",
  },
  nvidia: {
    name: "NVIDIA NIM (Cloud API)",
    default_url: "https://integrate.api.nvidia.com/v1",
    default_model: "meta/llama-3.3-70b-instruct",
    hint: "NVIDIA NIM Cloud. Zero VRAM impact on ComfyUI! Get free API key from build.nvidia.com.",
    key_placeholder: "nvapi-...",
  },
  openai: {
    name: "OpenAI (Cloud API)",
    default_url: "https://api.openai.com/v1",
    default_model: "gpt-4o-mini",
    hint: "Official OpenAI Cloud API. Uses API key from platform.openai.com.",
    key_placeholder: "sk-...",
  },
  gemini: {
    name: "Google Gemini (Cloud API)",
    default_url: "https://generativelanguage.googleapis.com/v1beta/openai",
    default_model: "gemini-2.0-flash",
    hint: "Google Gemini Cloud API via Google AI Studio with massive context window.",
    key_placeholder: "AIzaSy...",
  },
  custom: {
    name: "Custom (OpenAI-compatible)",
    default_url: "https://api.groq.com/openai/v1",
    default_model: "llama-3.3-70b-versatile",
    hint: "Any OpenAI-compatible server (Groq, OpenRouter, DeepSeek, vLLM, LMStudio, etc.).",
    key_placeholder: "API Key if required",
  },
};

const css = `
.sa-launcher{position:fixed;right:20px;bottom:20px;z-index:9998;width:48px;height:48px;border-radius:50%;
  border:1px solid #666;background:#2a2a2a;color:#ffd34d;font-size:22px;cursor:pointer;
  box-shadow:0 4px 14px rgba(0,0,0,.5)}
.sa-launcher:hover{background:#383838}
.sa-launcher.sa-on{background:#ffd34d;color:#222}
.sa-win{position:fixed;z-index:9999;display:none;flex-direction:column;background:var(--comfy-menu-bg,#202020);
  color:var(--fg-color,#ddd);border:1px solid #555;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,.55);
  overflow:hidden;min-width:320px;min-height:280px;resize:both;font-size:13px}
.sa-win.sa-docked{resize:none;border-radius:0;border-width:0 1px 0 0}
.sa-head{display:flex;align-items:center;gap:6px;padding:6px 8px;background:#2c2c2c;border-bottom:1px solid #444;
  cursor:move;user-select:none}
.sa-win.sa-docked .sa-head{cursor:default}
.sa-title{font-weight:600}
.sa-spacer{flex:1}
.sa-head button{background:none;border:none;color:inherit;cursor:pointer;font-size:14px;padding:2px 6px}
.sa-head button:hover{background:#444;border-radius:4px}
.sa-body{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}
.sa-grip{display:none;position:absolute;top:0;right:0;width:6px;height:100%;cursor:ew-resize}
.sa-win.sa-docked .sa-grip{display:block}
.sa-grip:hover{background:#ffd34d55}

/* Chat view */
.ca-wrap{display:flex;flex-direction:column;height:100%}
.ca-bar{display:flex;align-items:center;gap:6px;padding:6px;border-bottom:1px solid #444}
.ca-prov-badge{font-size:10px;font-weight:700;text-transform:uppercase;padding:2px 5px;border-radius:3px;
  background:#333;color:#ffd34d;border:1px solid #555;white-space:nowrap}
.ca-bar select{flex:1;min-width:0;background:#1a1a1a;color:#eee;border:1px solid #444;border-radius:4px;padding:3px 5px}
.ca-bar button{background:#333;border:1px solid #555;color:#eee;border-radius:4px;padding:3px 8px;cursor:pointer}
.ca-bar button:hover{background:#444}
.ca-log{flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:8px}
.ca-msg{white-space:pre-wrap;word-break:break-word;padding:6px 8px;border-radius:6px;line-height:1.4}
.ca-user{background:#2b3a4a;align-self:flex-end;max-width:90%}
.ca-bot{background:#2a2a2a;align-self:flex-start;max-width:92%}
.ca-err{background:#4a2b2b;color:#ffb3b3}
.ca-think{font-size:11px;color:#888;border-left:2px solid #555;padding-left:6px;margin-bottom:4px;white-space:pre-wrap}
.ca-in{display:flex;gap:6px;padding:6px;border-top:1px solid #444}
.ca-in textarea{flex:1;resize:none;height:56px;background:#181818;color:#eee;border:1px solid #444;border-radius:4px;padding:5px}
.ca-send{background:#ffd34d;border:none;border-radius:4px;color:#222;font-weight:600;padding:0 12px;cursor:pointer}
.ca-send:hover{background:#ffe066}

/* Settings view */
.sa-settings-wrap{display:none;flex-direction:column;height:100%;background:var(--comfy-menu-bg,#202020);color:var(--fg-color,#ddd)}
.sa-cfg-header{padding:8px 10px;background:#282828;border-bottom:1px solid #444;font-size:12px;font-weight:600;color:#ffd34d;display:flex;justify-content:space-between;align-items:center}
.sa-cfg-body{flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:9px}
.sa-cfg-group{display:flex;flex-direction:column;gap:3px}
.sa-cfg-group label{font-size:11px;color:#aaa;font-weight:600;text-transform:uppercase;letter-spacing:0.4px}
.sa-cfg-group input,.sa-cfg-group select,.sa-cfg-group textarea{background:#181818;color:#eee;border:1px solid #444;border-radius:4px;padding:5px 7px;font-size:12px;outline:none}
.sa-cfg-group input:focus,.sa-cfg-group select:focus,.sa-cfg-group textarea:focus{border-color:#ffd34d}
.sa-cfg-row-two{display:flex;gap:8px}
.sa-cfg-row-two .sa-cfg-group{flex:1}
.sa-cfg-hint{font-size:11px;color:#9cdcfe;background:#1a2530;border:1px solid #2d455d;border-radius:4px;padding:5px 8px;line-height:1.4}
.sa-cfg-footer{display:flex;gap:8px;padding:8px 10px;border-top:1px solid #444;background:#252525}
.sa-cfg-footer button{flex:1;padding:6px;border-radius:4px;border:none;cursor:pointer;font-size:12px;font-weight:600}
.sa-cfg-save{background:#ffd34d;color:#222}
.sa-cfg-save:hover{background:#ffe066}
.sa-cfg-cancel{background:#383838;color:#ccc}
.sa-cfg-cancel:hover{background:#484848}
`;

const ui = Object.assign(
  { mode: "float", open: false, x: null, y: null, w: 430, h: 570, dockW: 380 },
  (() => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } })()
);
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(ui)); } catch {} };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function buildPanel(root, settingsBtn) {
  root.insertAdjacentHTML("beforeend", `
    <div class="ca-wrap">
      <div class="ca-bar">
        <span class="ca-prov-badge">OLLAMA</span>
        <select class="ca-model"></select>
        <button class="ca-unload" title="Unload model from VRAM">Unload</button>
        <button class="ca-clear" title="Clear chat">Clear</button>
      </div>
      <div class="ca-log"></div>
      <div class="ca-in">
        <textarea class="ca-text" placeholder="Message (Enter = send, Shift+Enter = newline)"></textarea>
        <button class="ca-send">Send</button>
      </div>
    </div>
    <div class="sa-settings-wrap">
      <div class="sa-cfg-header">
        <span>⚙ Connection & Provider Settings</span>
      </div>
      <div class="sa-cfg-body">
        <div class="sa-cfg-group">
          <label>Provider</label>
          <select class="sa-cfg-provider">
            <option value="ollama">Ollama (Local)</option>
            <option value="nvidia">NVIDIA NIM (Cloud API)</option>
            <option value="openai">OpenAI (Cloud API)</option>
            <option value="gemini">Google Gemini (Cloud API)</option>
            <option value="custom">Custom (OpenAI-compatible)</option>
          </select>
        </div>
        <div class="sa-cfg-hint"></div>
        <div class="sa-cfg-group sa-group-key">
          <label>API Key</label>
          <input type="password" class="sa-cfg-key" placeholder="API Key">
        </div>
        <div class="sa-cfg-group">
          <label>Base URL / Host</label>
          <input type="text" class="sa-cfg-url" placeholder="API endpoint">
        </div>
        <div class="sa-cfg-group">
          <label>Model Name</label>
          <input type="text" class="sa-cfg-model" placeholder="Model identifier">
        </div>
        <div class="sa-cfg-row-two">
          <div class="sa-cfg-group">
            <label>Temperature</label>
            <input type="number" step="0.1" min="0" max="2" class="sa-cfg-temp" value="0.3">
          </div>
          <div class="sa-cfg-group">
            <label>Max Context</label>
            <input type="number" step="1024" min="512" max="131072" class="sa-cfg-ctx" value="8192">
          </div>
        </div>
        <div class="sa-cfg-group">
          <label>System Prompt</label>
          <textarea class="sa-cfg-prompt" rows="2"></textarea>
        </div>
      </div>
      <div class="sa-cfg-footer">
        <button class="sa-cfg-save">Save Settings</button>
        <button class="sa-cfg-cancel">Back to Chat</button>
      </div>
    </div>`);

  const $ = (s) => root.querySelector(s);
  const chatView = $(".ca-wrap");
  const settingsView = $(".sa-settings-wrap");
  const log = $(".ca-log"), sel = $(".ca-model"), box = $(".ca-text"), sendBtn = $(".ca-send");
  const provBadge = $(".ca-prov-badge"), unloadBtn = $(".ca-unload");

  // Settings inputs
  const cfgProv = $(".sa-cfg-provider"), cfgKey = $(".sa-cfg-key"), cfgUrl = $(".sa-cfg-url");
  const cfgModel = $(".sa-cfg-model"), cfgTemp = $(".sa-cfg-temp"), cfgCtx = $(".sa-cfg-ctx");
  const cfgPrompt = $(".sa-cfg-prompt"), cfgHint = $(".sa-cfg-hint");
  const saveBtn = $(".sa-cfg-save"), cancelBtn = $(".sa-cfg-cancel");

  let history = [];
  let busy = false;
  let activeConfig = {};

  const add = (cls, text) => {
    const d = document.createElement("div");
    d.className = "ca-msg " + cls;
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  };

  function updateHint(p) {
    const info = PROVIDER_INFO[p] || PROVIDER_INFO.custom;
    cfgHint.textContent = info.hint;
    cfgKey.placeholder = info.key_placeholder;
  }

  function toggleSettings(show) {
    const isShowing = show !== undefined ? show : settingsView.style.display !== "flex";
    if (isShowing) {
      loadSettingsIntoForm();
      chatView.style.display = "none";
      settingsView.style.display = "flex";
      settingsBtn.style.color = "#ffd34d";
    } else {
      chatView.style.display = "flex";
      settingsView.style.display = "none";
      settingsBtn.style.color = "inherit";
    }
  }

  async function loadSettingsIntoForm() {
    try {
      const res = await fetch("/superagent/config");
      const data = await res.json();
      activeConfig = data.config || {};
      const p = activeConfig.provider || "ollama";
      cfgProv.value = p;
      cfgKey.value = activeConfig.api_key || "";
      cfgUrl.value = activeConfig.base_url || activeConfig.ollama_host || (PROVIDER_INFO[p] && PROVIDER_INFO[p].default_url) || "";
      cfgModel.value = activeConfig.default_model || "";
      cfgTemp.value = activeConfig.temperature != null ? activeConfig.temperature : 0.3;
      cfgCtx.value = activeConfig.num_ctx || 8192;
      cfgPrompt.value = activeConfig.system_prompt || "";
      updateHint(p);
    } catch (e) {
      console.error("Failed to load config:", e);
    }
  }

  cfgProv.addEventListener("change", () => {
    const p = cfgProv.value;
    const info = PROVIDER_INFO[p] || PROVIDER_INFO.custom;
    cfgUrl.value = info.default_url || "";
    cfgModel.value = info.default_model || "";
    updateHint(p);
  });

  saveBtn.onclick = async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
    try {
      const p = cfgProv.value;
      const payload = {
        provider: p,
        api_key: cfgKey.value.trim(),
        base_url: cfgUrl.value.trim(),
        ollama_host: p === "ollama" ? cfgUrl.value.trim() : (activeConfig.ollama_host || "http://127.0.0.1:11434"),
        default_model: cfgModel.value.trim(),
        temperature: parseFloat(cfgTemp.value) || 0.3,
        num_ctx: parseInt(cfgCtx.value, 10) || 8192,
        system_prompt: cfgPrompt.value.trim(),
      };
      const res = await fetch("/superagent/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      activeConfig = data.config;
      toggleSettings(false);
      add("ca-bot", `⚡ Settings updated! Active Provider: ${p.toUpperCase()} (${payload.default_model})`);
      await loadModels();
    } catch (e) {
      alert("Error saving settings: " + e.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Settings";
    }
  };

  cancelBtn.onclick = () => toggleSettings(false);
  settingsBtn.onclick = () => toggleSettings();

  async function loadModels() {
    try {
      const r = await fetch("/superagent/models");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      const prov = (j.provider || "ollama").toUpperCase();
      provBadge.textContent = prov;
      if (prov !== "OLLAMA") {
        unloadBtn.title = "Cloud API does not consume local GPU VRAM";
        unloadBtn.style.opacity = "0.5";
      } else {
        unloadBtn.title = "Unload model from GPU memory";
        unloadBtn.style.opacity = "1";
      }

      const models = j.models || [];
      const current = j.default || "";
      if (models.length === 0 && current) models.push(current);

      let html = models.map((m) => `<option ${m === current ? "selected" : ""}>${m}</option>`).join("");
      html += `<option value="__custom__">+ Enter custom model...</option>`;
      sel.innerHTML = html;
    } catch (e) {
      provBadge.textContent = (activeConfig.provider || "API").toUpperCase();
      add("ca-err", "Models: " + e.message + "\nTip: Click ⚙ (Settings) to configure your API key or provider.");
    }
  }

  sel.addEventListener("change", async () => {
    if (sel.value === "__custom__") {
      const custom = prompt("Enter model identifier (e.g. meta/llama-3.3-70b-instruct or gpt-4o):");
      if (custom && custom.trim()) {
        const trimmed = custom.trim();
        const opt = document.createElement("option");
        opt.value = trimmed;
        opt.textContent = trimmed;
        opt.selected = true;
        sel.insertBefore(opt, sel.lastElementChild);
        // Persist default model
        await fetch("/superagent/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ default_model: trimmed }),
        });
      } else {
        await loadModels();
      }
    }
  });

  async function send() {
    const text = box.value.trim();
    if (!text || busy) return;
    busy = true; sendBtn.disabled = true; box.value = "";
    add("ca-user", text);
    history.push({ role: "user", content: text });
    const out = add("ca-bot", "…");
    let acc = "";
    let thinkAcc = "";

    try {
      const res = await fetch("/superagent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: sel.value, messages: history }),
      });
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line) continue;
          const c = JSON.parse(line);
          if (c.error) {
            out.classList.add("ca-err");
            out.textContent = c.error;
            continue;
          }
          if (c.thinking) {
            thinkAcc += c.thinking;
          }
          if (c.content) {
            acc += c.content;
            out.textContent = (thinkAcc ? `[Thinking: ${thinkAcc.slice(0, 100)}...]\n\n` : "") + acc;
            log.scrollTop = log.scrollHeight;
          }
        }
      }
      if (acc) {
        out.textContent = acc;
        history.push({ role: "assistant", content: acc });
      }
    } catch (e) {
      out.classList.add("ca-err");
      out.textContent = e.message;
    }
    busy = false; sendBtn.disabled = false; box.focus();
  }

  sendBtn.onclick = send;
  for (const ev of ["keydown", "keyup", "keypress"]) box.addEventListener(ev, (e) => e.stopPropagation());
  for (const ev of ["keydown", "keyup", "keypress"]) {
    settingsView.addEventListener(ev, (e) => e.stopPropagation());
  }

  box.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });
  $(".ca-clear").onclick = () => { history = []; log.innerHTML = ""; };
  unloadBtn.onclick = async () => {
    const prov = (provBadge.textContent || "").toLowerCase();
    if (prov !== "ollama") {
      add("ca-bot", "Cloud models run on remote servers and do not occupy local VRAM.");
      return;
    }
    const r = await fetch("/superagent/unload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: sel.value }),
    });
    add(r.ok ? "ca-bot" : "ca-err", r.ok ? "Unloaded " + sel.value : "Unload failed");
  };

  loadSettingsIntoForm();
  loadModels();
}

function createUI() {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const launcher = document.createElement("button");
  launcher.className = "sa-launcher";
  launcher.title = "Nodex SuperAgent";
  launcher.textContent = "⚡";

  const win = document.createElement("div");
  win.className = "sa-win";
  win.innerHTML = `
    <div class="sa-head">
      <span class="sa-title">⚡ Nodex SuperAgent</span>
      <span class="sa-spacer"></span>
      <button class="sa-settings" title="Settings">⚙</button>
      <button class="sa-dock"></button>
      <button class="sa-close" title="Close">✕</button>
    </div>
    <div class="sa-body"></div>
    <div class="sa-grip"></div>`;
  document.body.append(launcher, win);

  const settingsBtn = win.querySelector(".sa-settings");
  buildPanel(win.querySelector(".sa-body"), settingsBtn);

  const head = win.querySelector(".sa-head");
  const dockBtn = win.querySelector(".sa-dock");
  const grip = win.querySelector(".sa-grip");

  function apply() {
    win.style.display = ui.open ? "flex" : "none";
    launcher.classList.toggle("sa-on", ui.open);
    win.classList.toggle("sa-docked", ui.mode === "dock");
    if (ui.mode === "dock") {
      ui.dockW = clamp(ui.dockW, 280, Math.max(320, innerWidth * 0.7));
      Object.assign(win.style, {
        left: DOCK_LEFT + "px", top: DOCK_TOP + "px",
        width: ui.dockW + "px", height: `calc(100vh - ${DOCK_TOP}px)`,
      });
    } else {
      ui.w = clamp(ui.w, 320, innerWidth - 16);
      ui.h = clamp(ui.h, 280, innerHeight - 16);
      if (ui.x == null) ui.x = innerWidth - ui.w - 24;
      if (ui.y == null) ui.y = innerHeight - ui.h - 84;
      ui.x = clamp(ui.x, 0, innerWidth - 80);
      ui.y = clamp(ui.y, 0, innerHeight - 40);
      Object.assign(win.style, {
        left: ui.x + "px", top: ui.y + "px", width: ui.w + "px", height: ui.h + "px",
      });
    }
    dockBtn.textContent = ui.mode === "dock" ? "❐" : "⇤";
    dockBtn.title = ui.mode === "dock" ? "Float window" : "Dock to left";
  }

  launcher.onclick = () => { ui.open = !ui.open; save(); apply(); };
  win.querySelector(".sa-close").onclick = () => { ui.open = false; save(); apply(); };
  dockBtn.onclick = () => { ui.mode = ui.mode === "dock" ? "float" : "dock"; save(); apply(); };
  addEventListener("resize", apply);

  // drag (float mode)
  head.addEventListener("pointerdown", (e) => {
    if (ui.mode !== "float" || e.target.closest("button")) return;
    const dx = e.clientX - ui.x, dy = e.clientY - ui.y;
    head.setPointerCapture(e.pointerId);
    const move = (ev) => { ui.x = ev.clientX - dx; ui.y = ev.clientY - dy; apply(); };
    const up = () => { head.removeEventListener("pointermove", move); head.removeEventListener("pointerup", up); save(); };
    head.addEventListener("pointermove", move);
    head.addEventListener("pointerup", up);
  });

  // resize grip (dock mode)
  grip.addEventListener("pointerdown", (e) => {
    grip.setPointerCapture(e.pointerId);
    const move = (ev) => { ui.dockW = ev.clientX - DOCK_LEFT; apply(); };
    const up = () => { grip.removeEventListener("pointermove", move); grip.removeEventListener("pointerup", up); save(); };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
  });

  // native corner-resize (float mode) -> remember size
  let t;
  new ResizeObserver(() => {
    if (!ui.open || ui.mode !== "float") return;
    const w = win.offsetWidth, h = win.offsetHeight;
    if (w === ui.w && h === ui.h) return;
    ui.w = w; ui.h = h;
    clearTimeout(t); t = setTimeout(save, 300);
  }).observe(win);

  apply();
}

app.registerExtension({
  name: "nodex.superagent.panel",
  async setup() {
    createUI();
  },
});
