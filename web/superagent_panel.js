import { app } from "../../scripts/app.js";

const STORE = "nodex_superagent_ui";
const DOCK_LEFT = 56; // px: clears ComfyUI's left sidebar icon bar (tweak if needed)
const DOCK_TOP = 48; // px: clears ComfyUI's top bar (tweak if needed)

const css = `
.sa-launcher{position:fixed;right:20px;bottom:20px;z-index:9998;width:48px;height:48px;border-radius:50%;
  border:1px solid #666;background:#2a2a2a;color:#ffd34d;font-size:22px;cursor:pointer;
  box-shadow:0 4px 14px rgba(0,0,0,.5)}
.sa-launcher:hover{background:#383838}
.sa-launcher.sa-on{background:#ffd34d;color:#222}
.sa-win{position:fixed;z-index:9999;display:none;flex-direction:column;background:var(--comfy-menu-bg,#202020);
  color:var(--fg-color,#ddd);border:1px solid #555;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,.55);
  overflow:hidden;min-width:300px;min-height:260px;resize:both;font-size:13px}
.sa-win.sa-docked{resize:none;border-radius:0;border-width:0 1px 0 0}
.sa-head{display:flex;align-items:center;gap:6px;padding:6px 8px;background:#2c2c2c;border-bottom:1px solid #444;
  cursor:move;user-select:none}
.sa-win.sa-docked .sa-head{cursor:default}
.sa-title{font-weight:600}
.sa-spacer{flex:1}
.sa-head button{background:none;border:none;color:inherit;cursor:pointer;font-size:14px;padding:2px 6px}
.sa-head button:hover{background:#444;border-radius:4px}
.sa-body{flex:1;min-height:0;display:flex;flex-direction:column}
.sa-grip{display:none;position:absolute;top:0;right:0;width:6px;height:100%;cursor:ew-resize}
.sa-win.sa-docked .sa-grip{display:block}
.sa-grip:hover{background:#ffd34d55}
.ca-wrap{display:flex;flex-direction:column;height:100%}
.ca-bar{display:flex;gap:6px;padding:6px;border-bottom:1px solid #444}
.ca-bar select{flex:1;min-width:0}
.ca-log{flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:8px}
.ca-msg{white-space:pre-wrap;word-break:break-word;padding:6px 8px;border-radius:6px}
.ca-user{background:#2b3a4a;align-self:flex-end;max-width:90%}
.ca-bot{background:#2a2a2a}
.ca-err{background:#4a2b2b}
.ca-in{display:flex;gap:6px;padding:6px;border-top:1px solid #444}
.ca-in textarea{flex:1;resize:none;height:56px}
`;

const ui = Object.assign(
  { mode: "float", open: false, x: null, y: null, w: 420, h: 560, dockW: 380 },
  (() => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } })()
);
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(ui)); } catch {} };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function buildChat(root) {
  root.insertAdjacentHTML("beforeend", `
    <div class="ca-wrap">
      <div class="ca-bar">
        <select class="ca-model"></select>
        <button class="ca-unload" title="Unload model from memory">Unload</button>
        <button class="ca-clear">Clear</button>
      </div>
      <div class="ca-log"></div>
      <div class="ca-in">
        <textarea class="ca-text" placeholder="Message (Enter = send, Shift+Enter = newline)"></textarea>
        <button class="ca-send">Send</button>
      </div>
    </div>`);

  const $ = (s) => root.querySelector(s);
  const log = $(".ca-log"), sel = $(".ca-model"), box = $(".ca-text"), sendBtn = $(".ca-send");
  let history = [];
  let busy = false;

  const add = (cls, text) => {
    const d = document.createElement("div");
    d.className = "ca-msg " + cls;
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  };

  async function loadModels() {
    try {
      const r = await fetch("/superagent/models");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      sel.innerHTML = j.models.map((m) => `<option ${m === j.default ? "selected" : ""}>${m}</option>`).join("");
    } catch (e) {
      add("ca-err", "Models: " + e.message);
    }
  }

  async function send() {
    const text = box.value.trim();
    if (!text || busy) return;
    busy = true; sendBtn.disabled = true; box.value = "";
    add("ca-user", text);
    history.push({ role: "user", content: text });
    const out = add("ca-bot", "…");
    let acc = "";

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
          if (c.error) { out.classList.add("ca-err"); out.textContent = c.error; continue; }
          if (c.content) { acc += c.content; out.textContent = acc; log.scrollTop = log.scrollHeight; }
        }
      }
      if (acc) history.push({ role: "assistant", content: acc });
    } catch (e) {
      out.classList.add("ca-err");
      out.textContent = e.message;
    }
    busy = false; sendBtn.disabled = false; box.focus();
  }

  sendBtn.onclick = send;
  // keep ComfyUI shortcuts (Ctrl+Enter, Delete, etc.) from firing while typing here
  for (const ev of ["keydown", "keyup", "keypress"]) box.addEventListener(ev, (e) => e.stopPropagation());
  box.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });
  $(".ca-clear").onclick = () => { history = []; log.innerHTML = ""; };
  $(".ca-unload").onclick = async () => {
    const r = await fetch("/superagent/unload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: sel.value }),
    });
    add(r.ok ? "ca-bot" : "ca-err", r.ok ? "Unloaded " + sel.value : "Unload failed");
  };

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
      <button class="sa-dock"></button>
      <button class="sa-close" title="Close">✕</button>
    </div>
    <div class="sa-body"></div>
    <div class="sa-grip"></div>`;
  document.body.append(launcher, win);
  buildChat(win.querySelector(".sa-body"));

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
      ui.w = clamp(ui.w, 300, innerWidth - 16);
      ui.h = clamp(ui.h, 260, innerHeight - 16);
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
