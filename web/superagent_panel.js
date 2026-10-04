import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const STORE = "nodex_superagent_ui";
let latestGeneratedImage = null;
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
    default_model: "meta/llama-3.2-11b-vision-instruct",
    hint: "NVIDIA NIM Cloud. Zero VRAM impact on ComfyUI! Free API key from build.nvidia.com.",
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
.sa-launcher{position:fixed;z-index:9998;width:48px;height:48px;border-radius:50%;
  border:1px solid #666;background:#2a2a2a;color:#ffd34d;font-size:22px;cursor:grab;touch-action:none;user-select:none;
  box-shadow:0 4px 14px rgba(0,0,0,.5);transition:transform 0.15s ease}
.sa-launcher:hover{background:#383838;transform:scale(1.06)}
.sa-launcher:active{cursor:grabbing}
.sa-launcher.sa-on{background:#ffd34d;color:#222}
.sa-win{position:fixed;z-index:9999;display:none;flex-direction:column;background:var(--comfy-menu-bg,#202020);
  color:var(--fg-color,#ddd);border:1px solid #555;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,.55);
  overflow:hidden;min-width:320px;min-height:300px;resize:both;font-size:13px}
.sa-win.sa-docked{resize:none;border-radius:0;border-width:0 1px 0 0}
.sa-head{display:flex;align-items:center;gap:6px;padding:6px 8px;background:#2c2c2c;border-bottom:1px solid #444;
  cursor:move;user-select:none}
.sa-win.sa-docked .sa-head{cursor:default}
.sa-title{font-weight:600;display:flex;align-items:center;gap:4px}
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
.ca-msg{white-space:pre-wrap;word-break:break-word;padding:8px 10px;border-radius:6px;line-height:1.4}
.ca-user{background:#2b3a4a;align-self:flex-end;max-width:90%}
.ca-bot{background:#2a2a2a;align-self:flex-start;max-width:92%}
.ca-err{background:#4a2b2b;color:#ffb3b3;border-left:3px solid #f85149}
.ca-think{font-size:11px;color:#888;border-left:2px solid #555;padding-left:6px;margin-bottom:6px;white-space:pre-wrap}
.ca-in{display:flex;gap:6px;padding:6px;border-top:1px solid #444}
.ca-in textarea{flex:1;resize:none;height:56px;background:#181818;color:#eee;border:1px solid #444;border-radius:4px;padding:6px}
.ca-send{background:#ffd34d;border:none;border-radius:4px;color:#222;font-weight:600;padding:0 12px;cursor:pointer}
.ca-send:hover{background:#ffe066}

/* Action & Status Cards */
.ca-action-badge{display:inline-flex;align-items:center;gap:4px;background:#ffd34d22;color:#ffd34d;
  border:1px solid #ffd34d55;border-radius:4px;padding:3px 8px;font-size:11px;font-weight:600;margin-bottom:6px}
.ca-status-bar{display:flex;align-items:center;gap:8px;background:#182838;color:#79c0ff;
  border:1px solid #388bfd44;padding:8px 10px;border-radius:6px;font-size:12px;margin-top:6px}
.ca-spinner{animation:sa-spin 1.5s linear infinite;display:inline-block}
@keyframes sa-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
.ca-img-gallery{display:flex;flex-direction:column;gap:8px;margin-top:8px}
.ca-img-card{border-radius:6px;overflow:hidden;border:1px solid #444;background:#161616}
.ca-output-img{width:100%;max-height:360px;object-fit:contain;display:block;cursor:pointer;background:#111;transition:opacity 0.15s ease}
.ca-output-video{width:100%;max-height:360px;display:block;background:#111}
.ca-output-img:hover{opacity:0.92}
.ca-img-meta{display:flex;justify-content:space-between;align-items:center;padding:4px 8px;font-size:11px;color:#aaa;background:#222}
.ca-img-btn{background:#333;color:#eee;border:1px solid #555;border-radius:3px;padding:2px 7px;font-size:11px;cursor:pointer}
.ca-img-btn:hover{background:#444}

/* Interactive Option Chips */
.ca-options-box{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;padding-top:6px;border-top:1px solid #388bfd33}
.ca-option-chip{background:#182838;color:#79c0ff;border:1px solid #388bfd66;border-radius:12px;padding:3px 9px;font-size:11px;font-weight:600;cursor:pointer;transition:all 0.15s ease}
.ca-option-chip:hover{background:#23405e;border-color:#58a6ff;color:#fff;transform:translateY(-1px)}

/* Image Upload & Preview */
.ca-upload-btn{background:#333;color:#eee;border:1px solid #555;border-radius:4px;padding:0 8px;cursor:pointer;font-size:13px}
.ca-upload-btn:hover{background:#444}
.ca-img-preview-box{display:none;flex-wrap:wrap;gap:6px;padding:6px 8px;background:#181818;border-top:1px solid #333;font-size:11px;color:#aaa}
.ca-attachment-chip{display:flex;align-items:center;gap:5px;max-width:180px;padding:3px 5px;background:#242424;border:1px solid #444;border-radius:5px}
.ca-img-preview-thumb{width:28px;height:28px;object-fit:cover;border-radius:3px;border:1px solid #555}
.ca-img-preview-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ca-img-preview-rm{cursor:pointer;color:#f85149;font-weight:700;padding:0 4px}


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
  { mode: "float", open: false, x: null, y: null, w: 440, h: 580, dockW: 400, launcherX: null, launcherY: null },
  (() => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } })()
);
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(ui)); } catch {} };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Helper: Locate positive and negative prompt nodes in the current ComfyUI workflow
function findPromptNodes() {
  let positiveNode = null;
  let negativeNode = null;
  const nodes = app.graph?._nodes || [];

  // 1. Try tracing backward from KSampler inputs
  const ksamplers = nodes.filter((n) => n.type === "KSampler" || n.type === "KSamplerAdvanced");
  for (const k of ksamplers) {
    if (k.inputs) {
      if (k.inputs[1] && k.inputs[1].link != null) {
        const link = app.graph.links?.[k.inputs[1].link];
        if (link) positiveNode = app.graph.getNodeById(link.origin_id);
      }
      if (k.inputs[2] && k.inputs[2].link != null) {
        const link = app.graph.links?.[k.inputs[2].link];
        if (link) negativeNode = app.graph.getNodeById(link.origin_id);
      }
    }
  }

  // 2. Fallback: Search by node title or type
  if (!positiveNode) {
    positiveNode = nodes.find(
      (n) => (n.title && n.title.toLowerCase().includes("positive")) || n.type === "CLIPTextEncode"
    );
  }
  if (!negativeNode) {
    negativeNode = nodes.find(
      (n) => n !== positiveNode && ((n.title && n.title.toLowerCase().includes("negative")) || n.type === "CLIPTextEncode")
    );
  }

  return { positiveNode, negativeNode };
}

// Helper: Update text inside a prompt node
function setNodePromptText(node, text) {
  if (!node || !text) return false;
  const w = (node.widgets || []).find((w) => w.name === "text") || node.widgets?.[0];
  if (w) {
    w.value = text;
    if (w.callback) w.callback(text);
    node.setDirtyCanvas?.(true, true);
    app.graph?.setDirtyCanvas(true, true);
    return true;
  }
  return false;
}

function setWorkflowImage(filename) {
  const imageNode = (app.graph?._nodes || []).find((node) => node.type === "LoadImage");
  const widget = imageNode?.widgets?.find((item) => item.name === "image") || imageNode?.widgets?.[0];
  if (!widget || !filename) return false;
  widget.value = filename;
  if (widget.callback) widget.callback(filename);
  imageNode.setDirtyCanvas?.(true, true);
  app.graph?.setDirtyCanvas(true, true);
  return true;
}

function setWorkflowValue(selector, value) {
  if (!selector || value == null || value === "") return false;
  const nodes = app.graph?._nodes || [];
  const matches = nodes.filter((node) => {
    if (selector.node_id != null && String(node.id) !== String(selector.node_id)) return false;
    if (selector.node_type && node.type !== selector.node_type) return false;
    if (selector.node_title) {
      const titles = [node.title, node.properties?.["Node name for S&R"]].filter(Boolean);
      if (!titles.some((title) => title.toLowerCase() === selector.node_title.toLowerCase())) return false;
    }
    return true;
  });
  const node = matches[selector.index || 0];
  const widget = node?.widgets?.find((item) => item.name === selector.widget) ||
    (selector.widget ? null : node?.widgets?.[0]);
  if (!widget) return false;
  widget.value = value;
  if (widget.callback) widget.callback(value);
  node.setDirtyCanvas?.(true, true);
  app.graph?.setDirtyCanvas(true, true);
  return true;
}

function findWorkflowNodes(selector) {
  if (!selector) return [];
  return (app.graph?._nodes || []).filter((node) => {
    if (selector.node_id != null && String(node.id) !== String(selector.node_id)) return false;
    if (selector.node_type && node.type !== selector.node_type) return false;
    if (selector.node_title) {
      const titles = [node.title, node.properties?.["Node name for S&R"]].filter(Boolean);
      if (!titles.some((title) => title.toLowerCase() === selector.node_title.toLowerCase())) return false;
    }
    return true;
  });
}

function configureOptionalImageLinks(plan, selectedCount) {
  if (!plan.detach_unused_image_inputs || !app.graph) return;
  const graph = app.graph;
  graph.__nodexImageLinks ||= {};
  (plan.image_selectors || []).forEach((selector, index) => {
    const node = findWorkflowNodes(selector)[selector.index || 0];
    const imageInputName = `image_${index + 1}`;
    const input = node?.inputs?.find((item) => item.name === imageInputName || item.name.endsWith(`.${imageInputName}`) || item.name === "image");
    if (!node || !input) return;
    const key = `${node.id}:${input.name}`;
    if (index < selectedCount) {
      const saved = graph.__nodexImageLinks[key];
      if (saved && input.link == null) {
        graph.connect(saved.origin_id, saved.origin_slot, node.id, saved.target_slot);
      }
      return;
    }
    if (input.link != null) {
      const link = graph.links?.[input.link];
      if (link) {
        graph.__nodexImageLinks[key] = {
          origin_id: link.origin_id ?? link[1],
          origin_slot: link.origin_slot ?? link[2],
          target_slot: link.target_slot ?? link[4],
        };
        graph.removeLink(input.link);
      }
    }
  });
  graph.setDirtyCanvas?.(true, true);
}

function applyOrchestrationInputs(plan, action, attachments) {
  attachments = Array.isArray(attachments) ? attachments : (attachments ? [attachments] : []);
  if (!setWorkflowValue(plan.prompt_selector, action.prompt)) {
    return { ok: false, error: `Prompt input was not found for ${plan.skill_name}.` };
  }
  if (action.negative_prompt && plan.negative_prompt_selector) {
    setWorkflowValue(plan.negative_prompt_selector, action.negative_prompt);
  }
  if (plan.image_selector) {
    if (!attachments[0]?.name) return { ok: false, error: `${plan.skill_name} requires an attached image.` };
    const selectors = plan.image_selectors?.length ? plan.image_selectors : [plan.image_selector];
    if (attachments.length > selectors.length) return { ok: false, error: `${plan.skill_name} accepts up to ${selectors.length} images.` };
    configureOptionalImageLinks(plan, attachments.length);
    for (let i = 0; i < attachments.length; i++) {
      if (!setWorkflowValue(selectors[i], attachments[i].name)) {
        return { ok: false, error: `Image ${i + 1} input was not found for ${plan.skill_name}.` };
      }
    }
    if (plan.skill_id === "krea2_i2i") {
      const nodes = findWorkflowNodes({ node_type: "LoadImage" });
      if (nodes[1]) {
        // The shipped Krea Identity Edit graph keeps its optional second
        // reference group bypassed by default. Enable it only when present.
        nodes[1].mode = attachments.length > 1 ? 0 : 4;
        nodes[1].setDirtyCanvas?.(true, true);
      }
    }
  }
  if (plan.lora_required) {
    if (!plan.selected_lora) return { ok: false, error: "Choose the Krea identity LoRA that matches the person in the image." };
    if (!setWorkflowValue(plan.lora_selector, plan.selected_lora)) return { ok: false, error: "The selected identity LoRA input was not found in the workflow." };
    const loraNode = (app.graph?._nodes || []).find((node) => node.type === "LoraLoaderModelOnly");
    const strength = loraNode?.widgets?.find((widget) => widget.name === "strength_model");
    if (strength && plan.lora_strength != null) {
      strength.value = Number(plan.lora_strength);
      if (strength.callback) strength.callback(strength.value);
    }
  }
  if (plan.denoise != null) {
    const sampler = (app.graph?._nodes || []).find((node) => node.type === "KSampler");
    const denoise = sampler?.widgets?.find((widget) => widget.name === "denoise");
    if (denoise) { denoise.value = Number(plan.denoise); denoise.callback?.(denoise.value); }
  }
  return { ok: true };
}

// Helper: Map aspect ratio text to known combo values
function resolveAspectRatioCombo(options, req) {
  if (!options || !Array.isArray(options) || !req) return null;
  const clean = req.toLowerCase().replace(/[\s\-_:]/g, "");
  // 1. Direct match
  for (const opt of options) {
    const optClean = opt.toLowerCase().replace(/[\s\-_:]/g, "");
    if (optClean.includes(clean) || clean.includes(optClean)) return opt;
  }
  // 2. Keyword mapping
  if (clean.includes("169") || clean.includes("landscape") || clean.includes("wide")) {
    return options.find((o) => o.includes("16:9") || o.toLowerCase().includes("wide"));
  }
  if (clean.includes("916") || clean.includes("portrait")) {
    return options.find((o) => o.includes("9:16") || o.toLowerCase().includes("portrait"));
  }
  if (clean.includes("11") || clean.includes("square")) {
    return options.find((o) => o.includes("1:1") || o.toLowerCase().includes("square"));
  }
  if (clean.includes("43")) {
    return options.find((o) => o.includes("4:3"));
  }
  if (clean.includes("34")) {
    return options.find((o) => o.includes("3:4"));
  }
  if (clean.includes("219") || clean.includes("ultra")) {
    return options.find((o) => o.includes("21:9") || o.toLowerCase().includes("ultra"));
  }
  return null;
}

// Helper: Locate latent or resolution node on canvas
function findLatentOrResolutionNode() {
  const nodes = app.graph?._nodes || [];
  return nodes.find(
    (n) =>
      n.type === "ResolutionSelector" ||
      (n.widgets && n.widgets.some((w) => w.name === "aspect_ratio")) ||
      n.type === "EmptySD3LatentImage" ||
      n.type === "EmptyLatentImage" ||
      n.type === "EmptyLatentImagePresets" ||
      (n.widgets && n.widgets.some((w) => w.name === "width") && n.widgets.some((w) => w.name === "height"))
  );
}

// Helper: Set resolution (width & height, or aspect_ratio) on active canvas nodes
function setCanvasResolution(width, height, aspect) {
  const nodes = app.graph?._nodes || [];
  let updatedAny = false;
  let details = [];

  let reqAspect = (aspect || "").toLowerCase();
  let wVal = width ? parseInt(width, 10) : null;
  let hVal = height ? parseInt(height, 10) : null;

  if ((!wVal || !hVal) && reqAspect) {
    if (reqAspect.includes("full hd") || reqAspect.includes("1080p")) {
      wVal = 1920; hVal = 1080; reqAspect = "16:9";
    } else if (reqAspect === "hd" || reqAspect.includes("720p")) {
      wVal = 1280; hVal = 720; reqAspect = "16:9";
    } else if (reqAspect.includes("16:9") || reqAspect.includes("landscape") || reqAspect.includes("wide")) {
      wVal = 1024; hVal = 576; reqAspect = "16:9";
    } else if (reqAspect.includes("9:16") || reqAspect.includes("portrait")) {
      wVal = 576; hVal = 1024; reqAspect = "9:16";
    } else if (reqAspect.includes("1:1") || reqAspect.includes("square")) {
      wVal = 1024; hVal = 1024; reqAspect = "1:1";
    } else if (reqAspect.includes("4:3")) {
      wVal = 1024; hVal = 768; reqAspect = "4:3";
    } else if (reqAspect.includes("3:4")) {
      wVal = 768; hVal = 1024; reqAspect = "3:4";
    } else if (reqAspect.includes("21:9") || reqAspect.includes("ultra")) {
      wVal = 1344; hVal = 576; reqAspect = "21:9";
    }
  }

  if (wVal && hVal && !reqAspect) {
    if (wVal === hVal) reqAspect = "1:1";
    else if (wVal > hVal) reqAspect = "16:9";
    else reqAspect = "9:16";
  }

  // 1. Look for ResolutionSelector or nodes with aspect_ratio widget
  for (const node of nodes) {
    if (node.widgets) {
      const aspectWidget = node.widgets.find((w) => ["aspect_ratio", "ratio", "aspect"].includes(w.name));
      if (aspectWidget) {
        const comboValues = (aspectWidget.options && aspectWidget.options.values) || [
          "1:1 (Square)", "2:3 (Portrait Photo)", "3:2 (Photo)", "3:4 (Portrait Standard)",
          "4:3 (Standard)", "9:16 (Portrait Widescreen)", "16:9 (Widescreen)", "21:9 (Ultrawide)"
        ];
        let matched = resolveAspectRatioCombo(comboValues, reqAspect || `${wVal}:${hVal}`);
        if (!matched && reqAspect) {
          matched = reqAspect;
        }
        if (matched) {
          aspectWidget.value = matched;
          if (aspectWidget.callback) aspectWidget.callback(matched);
          node.setDirtyCanvas?.(true, true);
          updatedAny = true;
          details.push(`${node.title || node.type} aspect -> ${matched}`);
        }
      }
    }
  }

  // 2. Also look for EmptyLatentImage / EmptySD3LatentImage / width & height nodes
  for (const node of nodes) {
    if (node.widgets && (wVal || hVal)) {
      let updatedNode = false;
      for (const w of node.widgets) {
        if (w.name === "width" && wVal) {
          w.value = wVal;
          if (w.callback) w.callback(wVal);
          updatedNode = true;
        }
        if (w.name === "height" && hVal) {
          w.value = hVal;
          if (w.callback) w.callback(hVal);
          updatedNode = true;
        }
      }
      if (updatedNode) {
        node.setDirtyCanvas?.(true, true);
        updatedAny = true;
        details.push(`${node.title || node.type} -> ${wVal}x${hVal}`);
      }
    }
  }

  if (updatedAny) {
    app.graph?.setDirtyCanvas(true, true);
    if (app.canvas && typeof app.canvas.draw === "function") {
      app.canvas.draw(true, true);
    }
    return { success: true, details: details.join(", "), width: wVal, height: hVal, aspect: reqAspect };
  }

  return { success: false, error: "No resolution or latent node found on canvas" };
}

// Helper: Set KSampler settings on active canvas
function setCanvasSampler(settings) {
  const nodes = app.graph?._nodes || [];
  const ksampler = nodes.find((n) => n.type === "KSampler" || n.type === "KSamplerAdvanced");
  if (!ksampler) return { success: false, error: "No KSampler node found on canvas" };

  for (const w of ksampler.widgets || []) {
    if (settings.steps != null && w.name === "steps") {
      w.value = parseInt(settings.steps, 10);
      if (w.callback) w.callback(w.value);
    }
    if (settings.cfg != null && w.name === "cfg") {
      w.value = parseFloat(settings.cfg);
      if (w.callback) w.callback(w.value);
    }
    if (settings.denoise != null && w.name === "denoise") {
      w.value = parseFloat(settings.denoise);
      if (w.callback) w.callback(w.value);
    }
    if (settings.sampler_name && w.name === "sampler_name") {
      w.value = settings.sampler_name;
      if (w.callback) w.callback(w.value);
    }
    if (settings.scheduler && w.name === "scheduler") {
      w.value = settings.scheduler;
      if (w.callback) w.callback(w.value);
    }
  }

  ksampler.setDirtyCanvas?.(true, true);
  app.graph?.setDirtyCanvas(true, true);
  return { success: true, nodeTitle: ksampler.title || ksampler.type };
}

// Helper: Serialize current canvas workflow status for the LLM
function getWorkflowContext() {
  if (!app.graph || !app.graph._nodes || app.graph._nodes.length === 0) {
    return "Status: Canvas is empty (no active nodes).";
  }
  const nodes = app.graph._nodes;

  // Model checkpoint or UNET
  const ckpt = nodes.find((n) => n.type === "CheckpointLoaderSimple" || n.type === "CheckpointLoader");
  const unet = nodes.find((n) => n.type === "UNETLoader");
  const modelName =
    ckpt?.widgets?.find((w) => w.name === "ckpt_name")?.value ||
    unet?.widgets?.find((w) => w.name === "unet_name")?.value ||
    "Active Model";

  // Prompt nodes
  const { positiveNode, negativeNode } = findPromptNodes();
  const posVal = positiveNode?.widgets?.find((w) => w.name === "text")?.value || positiveNode?.widgets?.[0]?.value || "(empty)";
  const negVal = negativeNode?.widgets?.find((w) => w.name === "text")?.value || negativeNode?.widgets?.[0]?.value || "(empty)";

  // Resolution
  const latentNode = findLatentOrResolutionNode();
  let width = latentNode?.widgets?.find((w) => w.name === "width")?.value;
  let height = latentNode?.widgets?.find((w) => w.name === "height")?.value;
  if (width == null && latentNode?.widgets?.[0]) width = latentNode.widgets[0].value;
  if (height == null && latentNode?.widgets?.[1]) height = latentNode.widgets[1].value;
  const resStr = latentNode ? `${width}x${height} (Node #${latentNode.id}: ${latentNode.title || latentNode.type})` : "Default (Image/VAE)";

  // Active Input Image
  const imgNode = nodes.find((n) => n.type === "LoadImage");
  const imgVal = imgNode?.widgets?.find((w) => w.name === "image")?.value;

  // Sampler
  const ksampler = nodes.find((n) => n.type === "KSampler" || n.type === "KSamplerAdvanced");
  const steps = ksampler?.widgets?.find((w) => w.name === "steps")?.value || 20;
  const samplerName = ksampler?.widgets?.find((w) => w.name === "sampler_name")?.value || "euler";
  const cfg = ksampler?.widgets?.find((w) => w.name === "cfg")?.value || 7.0;
  const denoise = ksampler?.widgets?.find((w) => w.name === "denoise")?.value ?? 1.0;

  const nodeTypes = Array.from(new Set(nodes.map((n) => n.type))).join(", ");

  return `Current Canvas Workflow Status:
- Active Model: ${modelName}
- Current Resolution: ${resStr}
- Active Input Image: ${imgVal ? `"${imgVal}" (LoadImage Node #${imgNode.id})` : "None (Text-to-Image)"}
- Sampler Settings: ${samplerName} | Steps: ${steps} | CFG: ${cfg} | Denoise: ${denoise}
- Previous Canvas Positive Prompt (Node ${positiveNode ? positiveNode.id : "?"}): "${posVal}"
- Previous Canvas Negative Prompt (Node ${negativeNode ? negativeNode.id : "?"}): "${negVal}"
- Nodes Present: ${nodeTypes}
- Total Active Nodes: ${nodes.length}`;
}

// Helper: Render generated images directly inside the chat log
function renderGeneratedImages(images, targetEl) {
  if (!targetEl || !images || images.length === 0) return;
  const lastImage = [...images].reverse().find((item) => item.filename && !item._mediaType?.includes("video"));
  if (lastImage) latestGeneratedImage = { filename: lastImage.filename, subfolder: lastImage.subfolder || "", type: lastImage.type || "output" };
  const container = document.createElement("div");
  container.className = "ca-img-gallery";
  for (const img of images) {
    const url = `/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || "")}&type=${encodeURIComponent(img.type || "output")}`;
    const imgWrapper = document.createElement("div");
    imgWrapper.className = "ca-img-card";
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    link.title = "Open full-size result";
    const isVideo = img._mediaType === "videos" || /\.(mp4|webm|mov|m4v)$/i.test(img.filename || "");
    if (isVideo) {
      const video = document.createElement("video");
      video.src = url;
      video.controls = true;
      video.className = "ca-output-video";
      link.appendChild(video);
    } else {
      const image = document.createElement("img");
      image.src = url;
      image.alt = "Generated image";
      image.className = "ca-output-img";
      link.appendChild(image);
    }
    imgWrapper.appendChild(link);
    const meta = document.createElement("div");
    meta.className = "ca-img-meta";
    const filename = document.createElement("span");
    filename.textContent = img.filename || "Generated output";
    meta.appendChild(filename);
    const open = document.createElement("button");
    open.className = "ca-img-btn";
    open.textContent = "Open";
    open.title = "Open full resolution";
    open.onclick = (e) => {
      e.preventDefault();
      window.open(url, "_blank");
    };
    meta.appendChild(open);
    imgWrapper.appendChild(meta);
    container.appendChild(imgWrapper);
  }
  targetEl.innerHTML = "";
  targetEl.appendChild(container);
  targetEl.scrollIntoView({ behavior: "smooth" });
}

async function copyGeneratedImageToInput(output) {
  if (!output?.filename) return null;
  const query = new URLSearchParams({ filename: output.filename, subfolder: output.subfolder || "", type: output.type || "output" });
  const imageResponse = await fetch(`/view?${query}`);
  if (!imageResponse.ok) throw new Error("Could not read the previous generated image from ComfyUI output.");
  const form = new FormData();
  form.append("image", await imageResponse.blob(), output.filename);
  form.append("type", "input");
  form.append("overwrite", "true");
  const uploadResponse = await fetch("/upload/image", { method: "POST", body: form });
  const uploaded = await uploadResponse.json();
  if (!uploadResponse.ok || !uploaded.name) throw new Error(uploaded.error || "Could not reuse the previous generated image as an edit input.");
  return { name: uploaded.name, subfolder: uploaded.subfolder || "", type: "input" };
}

// Helper: Load a workflow JSON by name into ComfyUI canvas
async function loadWorkflowByName(name) {
  try {
    const key = String(name || "");
    const query = key.includes(":") ? `id=${encodeURIComponent(key)}` : `name=${encodeURIComponent(key)}`;
    const res = await fetch(`/superagent/workflow?${query}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Workflow not found");
    if (data && typeof data === "object") {
      if (data.links && (!data.version || parseFloat(data.version) < 0.4)) {
        data.version = 0.4;
      }
    }
    if (typeof app.loadGraphData === "function") {
      await app.loadGraphData(data);
    } else if (app.graph && typeof app.graph.configure === "function") {
      app.graph.configure(data);
    }
    // Refresh canvas and center
    if (app.canvas && typeof app.canvas.draw === "function") {
      app.canvas.draw(true, true);
    }
    app.graph?.setDirtyCanvas?.(true, true);
    try {
      if (app.canvas && typeof app.canvas.centerOnNode === "function" && app.graph?._nodes?.[0]) {
        app.canvas.centerOnNode(app.graph._nodes[0]);
      }
    } catch {}
    return true;
  } catch (err) {
    console.error("Failed to load workflow:", err);
    return false;
  }
}

// Helper: Open ComfyUI's native Template Browser
function openNativeTemplateBrowser() {
  const sideBtn = document.querySelector('[data-testid="side-toolbar-templates"], button[title*="Templates"], .icon-\\[comfy--template\\]');
  if (sideBtn) {
    sideBtn.click();
    return true;
  }
  if (typeof app.showTemplateDialog === "function") {
    app.showTemplateDialog();
    return true;
  }
  const buttons = Array.from(document.querySelectorAll("button, a, div[role='button']"));
  const btn = buttons.find(b => (b.textContent || "").trim().toLowerCase() === "templates" || (b.title || "").toLowerCase().includes("templates"));
  if (btn) {
    btn.click();
    return true;
  }
  return false;
}

// Helper: Run ComfyUI generation and track real-time progress & outputs
function executeGeneration(promptText, statusEl) {
  const { positiveNode } = findPromptNodes();
  if (positiveNode && promptText) {
    setNodePromptText(positiveNode, promptText);
  }

  if (statusEl) {
    statusEl.innerHTML = `<div class="ca-status-bar"><span class="ca-spinner">⚡</span> Queuing generation in ComfyUI...</div>`;
  }

  return new Promise((resolve) => {
    let imagesFound = [];
    let lastError = null;

    const onProgress = (e) => {
      const { value, max } = e.detail || {};
      if (statusEl && max) {
        const pct = Math.round((value / max) * 100);
        statusEl.innerHTML = `<div class="ca-status-bar"><span class="ca-spinner">⚙</span> Sampling step ${value}/${max} (${pct}%)</div>`;
      }
    };

    const onExecuting = (e) => {
      const nodeId = e.detail;
      if (nodeId === null) {
        // Queue has finished executing!
        setTimeout(() => {
          cleanup();
          if (imagesFound.length > 0) {
            renderGeneratedImages(imagesFound, statusEl);
          } else if (lastError) {
            statusEl.innerHTML = `<div class="ca-err">❌ Execution failed: ${lastError}</div>`;
          } else {
            statusEl.innerHTML = `<div class="ca-err">⚠️ Generation ended without output images. (Check ComfyUI Job Queue / Console for errors)</div>`;
          }
          resolve(imagesFound);
        }, 500);
      } else {
        const node = app.graph?.getNodeById?.(nodeId);
        const nodeTitle = node?.title || node?.type || `Node #${nodeId}`;
        if (statusEl && !statusEl.innerHTML.includes("Sampling step")) {
          statusEl.innerHTML = `<div class="ca-status-bar"><span class="ca-spinner">⚙</span> Executing ${nodeTitle}...</div>`;
        }
      }
    };

    const onExecuted = (e) => {
      const output = e.detail?.output;
      if (output) {
        for (const key of ["images", "gifs", "videos"]) {
          if (Array.isArray(output[key])) {
            imagesFound = imagesFound.concat(output[key].map((item) => ({ ...item, _mediaType: key })));
          }
        }
      }
    };

    const onError = (e) => {
      const detail = e.detail || {};
      const msg = detail.exception_message || detail.message || detail.exception_type || "Execution failed in ComfyUI";
      lastError = msg;
      cleanup();
      if (statusEl) {
        statusEl.innerHTML = `<div class="ca-err">❌ Generation error: ${msg}</div>`;
      }
      resolve(null);
    };

    const onInterrupted = () => {
      cleanup();
      if (statusEl) {
        statusEl.innerHTML = `<div class="ca-err">⚠️ Generation was canceled / interrupted.</div>`;
      }
      resolve(null);
    };

    const onStatus = (e) => {
      const remaining = e.detail?.status?.exec_info?.queue_remaining;
      if (remaining === 0) {
        setTimeout(() => {
          if (imagesFound.length > 0) {
            cleanup();
            renderGeneratedImages(imagesFound, statusEl);
            resolve(imagesFound);
          }
        }, 500);
      }
    };

    const cleanup = () => {
      api.removeEventListener("progress", onProgress);
      api.removeEventListener("executing", onExecuting);
      api.removeEventListener("executed", onExecuted);
      api.removeEventListener("execution_error", onError);
      api.removeEventListener("execution_interrupted", onInterrupted);
      api.removeEventListener("status", onStatus);
    };

    api.addEventListener("progress", onProgress);
    api.addEventListener("executing", onExecuting);
    api.addEventListener("executed", onExecuted);
    api.addEventListener("execution_error", onError);
    api.addEventListener("execution_interrupted", onInterrupted);
    api.addEventListener("status", onStatus);

    try {
      app.queuePrompt(0, 1);
    } catch (err) {
      cleanup();
      if (statusEl) statusEl.innerHTML = `<div class="ca-err">Failed to queue: ${err.message}</div>`;
      resolve(null);
    }

    // Safety fallback: if no event resolves within 3 minutes
    setTimeout(() => {
      cleanup();
      if (imagesFound.length > 0) {
        renderGeneratedImages(imagesFound, statusEl);
      } else if (lastError) {
        if (statusEl) statusEl.innerHTML = `<div class="ca-err">❌ Generation failed: ${lastError}</div>`;
      }
      resolve(imagesFound);
    }, 180000);
  });
}

function buildPanel(root, settingsBtn) {
  root.insertAdjacentHTML("beforeend", `
    <div class="ca-wrap">
      <div class="ca-bar">
        <span class="ca-prov-badge">OLLAMA</span>
        <select class="ca-model" title="Model Selector"></select>
        <select class="ca-workflow" title="Load Workflow Template onto Canvas">
          <option value="">📁 Workflow: (Active)</option>
        </select>
        <button class="ca-browse-templates" title="Open ComfyUI Templates Browser">Templates</button>
        <button class="ca-unload" title="Unload model from VRAM">Unload</button>
        <button class="ca-clear" title="Clear chat">Clear</button>
      </div>
      <div class="ca-log"></div>
      <div class="ca-img-preview-box"></div>
      <div class="ca-in">
        <input type="file" class="ca-file-input" accept="image/*" multiple style="display:none">
        <button class="ca-upload-btn" title="Upload images (Krea Identity Edit: up to 2; Qwen Image 2.1: up to 10)">📷+</button>
        <textarea class="ca-text" placeholder="Message or ask to generate an image... (Enter = send, Shift+Enter = newline)"></textarea>
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
            <input type="number" step="0.1" min="0" max="2" class="sa-cfg-temp" value="0.4">
          </div>
          <div class="sa-cfg-group">
            <label>Max Context</label>
            <input type="number" step="1024" min="512" max="131072" class="sa-cfg-ctx" value="8192">
          </div>
        </div>
        <div class="sa-cfg-group">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;text-transform:none;font-weight:normal;color:#eee">
            <input type="checkbox" class="sa-cfg-options" checked>
            <span>Enable Interactive Question Options (Clickable Chips)</span>
          </label>
        </div>
        <div class="sa-cfg-group">
          <label>System Prompt</label>
          <textarea class="sa-cfg-prompt" rows="3"></textarea>
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
  const provBadge = $(".ca-prov-badge"), unloadBtn = $(".ca-unload"), wfSel = $(".ca-workflow");
  const templateBtn = $(".ca-browse-templates"), uploadBtn = $(".ca-upload-btn"), fileInput = $(".ca-file-input");
  const previewBox = $(".ca-img-preview-box");
  const cfgOptions = $(".sa-cfg-options");

  let currentAttachments = [];
  let workflowCatalog = [];
  let availableSkills = [];

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
      cfgKey.value = activeConfig.api_key === "********" ? "" : (activeConfig.api_key || "");
      cfgKey.placeholder = activeConfig.api_key === "********" ? "Saved key kept when blank; enter to replace" : "API key";
      cfgUrl.value = activeConfig.base_url || activeConfig.ollama_host || (PROVIDER_INFO[p] && PROVIDER_INFO[p].default_url) || "";
      cfgModel.value = activeConfig.default_model || "";
      cfgTemp.value = activeConfig.temperature != null ? activeConfig.temperature : 0.4;
      cfgCtx.value = activeConfig.num_ctx || 8192;
      cfgPrompt.value = activeConfig.system_prompt || "";
      cfgOptions.checked = activeConfig.interactive_options !== false;
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
        base_url: cfgUrl.value.trim(),
        ollama_host: p === "ollama" ? cfgUrl.value.trim() : (activeConfig.ollama_host || "http://127.0.0.1:11434"),
        default_model: cfgModel.value.trim(),
        temperature: parseFloat(cfgTemp.value) || 0.4,
        num_ctx: parseInt(cfgCtx.value, 10) || 8192,
        interactive_options: cfgOptions.checked,
        system_prompt: cfgPrompt.value.trim(),
      };
      // An empty password field means "keep the saved key"; keys are never returned to the browser.
      if (cfgKey.value.trim()) payload.api_key = cfgKey.value.trim();
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

  // Browse ComfyUI Native Templates
  templateBtn.onclick = () => {
    const opened = openNativeTemplateBrowser();
    if (!opened) {
      add("ca-bot", "📁 Open ComfyUI Templates using the sidebar 'Templates' button or the Workflow dropdown above.");
    }
  };

  // Image Upload Handling
  uploadBtn.onclick = () => fileInput.click();

  const renderAttachmentPreview = () => {
    previewBox.replaceChildren();
    previewBox.style.display = currentAttachments.length ? "flex" : "none";
    currentAttachments.forEach((attachment, index) => {
      const chip = document.createElement("div");
      chip.className = "ca-attachment-chip";
      const thumb = document.createElement("img");
      thumb.className = "ca-img-preview-thumb";
      thumb.src = attachment.url;
      thumb.alt = `Image ${index + 1}`;
      const name = document.createElement("span");
      name.className = "ca-img-preview-name";
      name.textContent = `${index + 1}. ${attachment.name}`;
      name.title = attachment.name;
      const remove = document.createElement("button");
      remove.className = "ca-img-preview-rm";
      remove.type = "button";
      remove.textContent = "×";
      remove.title = `Remove image ${index + 1}`;
      remove.onclick = () => {
        currentAttachments.splice(index, 1);
        renderAttachmentPreview();
      };
      chip.append(thumb, name, remove);
      previewBox.appendChild(chip);
    });
  };

  fileInput.onchange = async () => {
    const files = Array.from(fileInput.files || []);
    if (!files.length) return;
    if (currentAttachments.length + files.length > 10) {
      add("ca-err", `You can attach up to 10 images in one message. Remove ${currentAttachments.length + files.length - 10} image(s) and try again.`);
      fileInput.value = "";
      return;
    }
    try {
      uploadBtn.textContent = "⏳";
      for (const file of files) {
        const formData = new FormData();
        formData.append("image", file);
        formData.append("overwrite", "true");
        const res = await fetch("/upload/image", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Upload failed for ${file.name}`);
        currentAttachments.push({
          name: data.name,
          subfolder: data.subfolder || "",
          type: data.type || "input",
          url: `/view?filename=${encodeURIComponent(data.name)}&subfolder=${encodeURIComponent(data.subfolder || "")}&type=${encodeURIComponent(data.type || "input")}`,
        });
      }
      renderAttachmentPreview();

      // Populate active canvas LoadImage nodes in upload order for direct editing.
      const imageNodes = (app.graph?._nodes || []).filter((node) => node.type === "LoadImage");
      currentAttachments.forEach((attachment, index) => {
        const node = imageNodes[index];
        const widget = node?.widgets?.find((item) => item.name === "image") || node?.widgets?.[0];
        if (widget) {
          widget.value = attachment.name;
          widget.callback?.(attachment.name);
          node.setDirtyCanvas?.(true, true);
        }
      });
      if (files.length) add("ca-bot", `📷 Uploaded ${files.length} image${files.length === 1 ? "" : "s"}; the selected order is preserved.`);
    } catch (err) {
      alert("Image upload failed: " + err.message);
    } finally {
      uploadBtn.textContent = "📷+";
      fileInput.value = "";
    }
  };

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

  async function loadWorkflowsList() {
    try {
      const res = await fetch("/superagent/workflows");
      const data = await res.json();
      if (!res.ok) return;
      workflowCatalog = data.workflows || [];
      availableSkills = data.skills || [];
      wfSel.replaceChildren(new Option("📁 Workflow: (Active Canvas)", ""));
      for (const workflow of workflowCatalog) {
        const option = new Option(`${workflow.name} · ${workflow.source}`, workflow.id);
        wfSel.appendChild(option);
      }
    } catch (e) {
      console.warn("Failed to load workflow list:", e);
    }
  }

  wfSel.addEventListener("change", async () => {
    const chosen = wfSel.value;
    if (!chosen) return;
    const ok = await loadWorkflowByName(chosen);
    if (ok) {
      add("ca-bot", `⚡ Loaded workflow "${chosen}" onto canvas.`);
    } else {
      add("ca-err", `❌ Failed to load workflow "${chosen}".`);
    }
  });

  async function send() {
    const text = box.value.trim();
    if ((!text && !currentAttachments.length) || busy) return;
    busy = true; sendBtn.disabled = true; box.value = "";

    const previousUserTurns = history.filter((message) => message.role === "user");
    const previousImageMessage = [...previousUserTurns].reverse().find((message) => message.attachments?.length || message.attachment?.name);
    const previousActionMessage = [...previousUserTurns].reverse().find((message) =>
      /\b(create|generate|make|render|animate|edit|change|replace|remove|restyle|inpaint|outpaint|transform|upscale)\b/i.test(message.content || "")
    );
    const previousActionText = (previousActionMessage?.content || "").replace(/\[Attached Image:[^\]]+\]/g, "").trim();
    const shortFollowUp = /^(?:(?:use|with)\s+)?(?:krea(?:\s*2)?|qwen(?:\s+image)?|ltx(?:\s*2?\.?3)?|minimax|mini\s*max)(?:\s+(?:text\s+to\s+image|image\s+to\s+image|text\s+to\s+video|image\s+to\s+video|t2i|i2i|t2v|i2v))?[.!?\s]*$|^(?:now|do it|go ahead|continue|again|run it)[.!?\s]*$/i.test(text);
    const regenerateFollowUp = /\b(?:re[\s-]*g(?:e)?nerate|regenerate|again|same image)\b/i.test(text);
    const continuePreviousTask = shortFollowUp || regenerateFollowUp;
    const currentLooksLikeEdit = /\b(edit|change|chage|replace|remove|restyle|inpaint|outpaint|move|put|place|position|sit|stand|turn|t[\s-]?shirt|shirt|clothing|hair|background|colour|color|face)\b/i.test(text);
    const priorLooksLikeEdit = /\b(edit|change|chage|replace|remove|restyle|inpaint|outpaint|t[\s-]?shirt|shirt|clothing|hair|background|colour|color|face)\b/i.test(previousActionText);
    const planningText = continuePreviousTask && previousActionText ? `${previousActionText}\n${text}` : text;

    let userDisplay = text;
    let userPrompt = text;
    let attachmentObjs = currentAttachments.map(({ name, subfolder, type }) => ({ name, subfolder, type }));
    if (attachmentObjs.length) {
      const labels = attachmentObjs.map((item, index) => `[Attached Image ${index + 1}: ${item.name}]`);
      const names = attachmentObjs.map((item, index) => `${index + 1}. ${item.name}`).join("\n");
      userDisplay = userDisplay ? `${userDisplay}\n📷 ${names}` : `📷 ${names}`;
      userPrompt = `${userPrompt}${userPrompt ? "\n" : ""}${labels.join("\n")}`;
      currentAttachments = [];
      renderAttachmentPreview();
    }
    let routingAttachments = attachmentObjs.length ? attachmentObjs : [];
    if (!routingAttachments.length && previousImageMessage && !(currentLooksLikeEdit && latestGeneratedImage) && (currentLooksLikeEdit || (continuePreviousTask && priorLooksLikeEdit))) {
      routingAttachments = previousImageMessage.attachments || (previousImageMessage.attachment ? [previousImageMessage.attachment] : []);
    }
    if (!routingAttachments.length && currentLooksLikeEdit && latestGeneratedImage) {
      try { routingAttachments = [await copyGeneratedImageToInput(latestGeneratedImage)]; }
      catch (reuseError) { console.warn("Could not reuse the latest generated image", reuseError); }
    }

    add("ca-user", userDisplay);
    history.push({ role: "user", content: userPrompt, attachments: attachmentObjs });

    const out = add("ca-bot", "…");
    let acc = "";
    let thinkAcc = "";

    // Extract live canvas workflow context
    const workflowContext = getWorkflowContext();

    try {
      let orchestrationPlan = { status: "chat", intent: "chat" };
      try {
        const planRes = await fetch("/superagent/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            request: planningText,
            has_image: routingAttachments.length > 0,
            active_workflow: wfSel.value || null,
          }),
        });
        const planData = await planRes.json();
        if (!planRes.ok) throw new Error(planData.error || "Planner request failed");
        orchestrationPlan = planData.plan;
      } catch (planError) {
        orchestrationPlan = { status: "planner_error", message: planError.message };
      }

      if (orchestrationPlan.max_images && routingAttachments.length > orchestrationPlan.max_images) {
        out.textContent = `${orchestrationPlan.skill_name} accepts up to ${orchestrationPlan.max_images} images in one request; ${routingAttachments.length} are attached. Remove the extra images and resend. No workflow was loaded or queued.`;
        currentAttachments = routingAttachments.map((attachment) => ({
          ...attachment,
          url: attachment.url || `/view?filename=${encodeURIComponent(attachment.name)}&subfolder=${encodeURIComponent(attachment.subfolder || "")}&type=${encodeURIComponent(attachment.type || "input")}`,
        }));
        renderAttachmentPreview();
        busy = false; sendBtn.disabled = false; box.focus();
        return;
      }

      if (orchestrationPlan.status === "canvas_settings") {
        const target = /full\s*hd|1080p/i.test(text) ? "full hd" : /\bhd\b|720p/i.test(text) ? "hd" :
          (text.match(/16[:/x]9|9[:/x]16|1[:/x]1|4[:/x]3|3[:/x]4|21[:/x]9|landscape|portrait|square|widescreen|ultrawide/i) || [])[0];
        const dimensions = text.match(/(\d{3,4})\s*[x×]\s*(\d{3,4})/i);
        const updated = setCanvasResolution(dimensions?.[1] || null, dimensions?.[2] || null, target);
        out.textContent = updated.success
          ? `📐 Active workflow resolution updated (${updated.details}). The workflow was not loaded or run.`
          : `Could not update the active workflow: ${updated.error}. No workflow was loaded or run.`;
        busy = false; sendBtn.disabled = false; box.focus();
        return;
      }

      const res = await fetch("/superagent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: sel.value,
          messages: history.map((m, index) => ({
            role: m.role,
            content: m.content,
            // Send pixels only for this request's explicit or intentionally
            // reused image context. Old uploads stay in text history, not as
            // accidental visual input to unrelated new generations.
            attachments: index === history.length - 1 ? routingAttachments : [],
          })),
          workflow_context: workflowContext,
          orchestration_plan: orchestrationPlan,
        }),
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
        history.push({ role: "assistant", content: acc });

        // Parse Action Tags from assistant response - flexible pattern matching
        const editActionMatch = acc.match(/<SUPERAGENT_ACTION>([\s\S]*?)<\/SUPERAGENT_ACTION>/i);
        let orchestratorAction = null;
        if (editActionMatch) {
          try {
            const candidate = JSON.parse(editActionMatch[1]);
            if (["run", "edit_image", "generate_image", "generate_video"].includes(candidate?.type) && typeof candidate.prompt === "string" && candidate.prompt.trim()) orchestratorAction = candidate;
          } catch (err) {
            console.warn("Invalid orchestrator action payload", err);
          }
        }
        // Accept the legacy action emitted by older prompts/models, but route it
        // through the same validated plan and preflight as current actions.
        const legacyEditMatch = acc.match(/\[ACTION:EDIT_IMAGE\s+prompt=["']([\s\S]*?)["']\s*\]/i);
        if (!orchestratorAction && legacyEditMatch && legacyEditMatch[1].trim()) {
          orchestratorAction = { type: "edit_image", prompt: legacyEditMatch[1].trim() };
        }
        const resMatch = acc.match(/\[ACTION:SET_RESOLUTION(?:\s+width=["']?(\d+)["']?)?(?:\s+height=["']?(\d+)["']?)?(?:\s+aspect_ratio=["']?([^"'\s\]]+)["']?)?\]/i);
        const samplerMatch = acc.match(/\[ACTION:SET_SAMPLER(?:\s+steps=["']?(\d+)["']?)?(?:\s+cfg=["']?([\d\.]+)["']?)?(?:\s+denoise=["']?([\d\.]+)["']?)?(?:\s+sampler=["']?([^"'\s\]]+)["']?)?(?:\s+scheduler=["']?([^"'\s\]]+)["']?)?\]/i);
        const loadMatch = acc.match(/\[ACTION:(?:LOAD_WORKFLOW|SET_WORKFLOW|USE_WORKFLOW)\s+(?:name|template|workflow)=["']?([^"'\s\]]+)["']?(?:\s+prompt=["'](.*?)["'])?\]/i);
        const genMatch = acc.match(/\[ACTION:GENERATE_IMAGE\s+prompt=["'](.*?)["']\]/i);
        const setMatch = acc.match(/\[ACTION:SET_PROMPT(?:\s+positive=["'](.*?)["'])?(?:\s+negative=["'](.*?)["'])?\]/i);
        const runMatch = acc.match(/\[ACTION:RUN_WORKFLOW\]/i);
        const safeFallbackIntent = ["text_to_image", "image_edit", "text_to_video", "image_to_video", "image_with_references"].includes(orchestrationPlan.intent);
        const modelRefused = /cannot provide|can't provide|cannot help|can't help|not appropriate or ethical|safety policy/i.test(acc);
        if (!orchestratorAction && !genMatch && !runMatch && orchestrationPlan.status === "ready" && safeFallbackIntent && !modelRefused) {
          // The user explicitly requested generation (the planner only returns
          // these intents for action verbs). If the LLM returns prose/caption
          // instead of a tag, use the request as the prompt after preflight.
          orchestratorAction = {
            type: orchestrationPlan.intent === "image_edit" ? "edit_image" : "run",
            prompt: planningText,
          };
        }
        const generationRequested = !!(orchestratorAction || genMatch || runMatch);

        // Parse Option Chips from assistant response
        const optMatch = acc.match(/\[OPTIONS:\s*(.*?)\]/i);
        let optionChips = [];
        if (optMatch) {
          const rawOpts = optMatch[1];
          optionChips = rawOpts
            .split("|")
            .map((s) => s.trim().replace(/^["']|["']$/g, ""))
            .filter(Boolean);
        }

        let cleanText = acc
          .replace(/<SUPERAGENT_ACTION>[\s\S]*?<\/SUPERAGENT_ACTION>/gi, "")
          .replace(/\[ACTION:EDIT_IMAGE\s+prompt=["'][\s\S]*?["']\s*\]/gi, "")
          .replace(/^\s*\[INFO:GENERATION\][^\n]*(?:\n|$)/gim, "")
          .replace(/\[ACTION:SET_RESOLUTION(?:\s+width=["']?\d+["']?)?(?:\s+height=["']?\d+["']?)?(?:\s+aspect_ratio=["']?[^"'\s\]]+["']?)?\]/gi, "")
          .replace(/\[ACTION:SET_SAMPLER(?:\s+steps=["']?\d+["']?)?(?:\s+cfg=["']?[\d\.]+["']?)?(?:\s+denoise=["']?[\d\.]+["']?)?(?:\s+sampler=["']?[^"'\s\]]+["']?)?(?:\s+scheduler=["']?[^"'\s\]]+["']?)?\]/gi, "")
          .replace(/\[ACTION:(?:LOAD_WORKFLOW|SET_WORKFLOW|USE_WORKFLOW)\s+(?:name|template|workflow)=["']?.*?["']?(?:\s+prompt=["'].*?["'])?\]/gi, "")
          .replace(/\[ACTION:GENERATE_IMAGE\s+prompt=["'].*?["']\]/gi, "")
          .replace(/\[ACTION:SET_PROMPT(?:\s+positive=["'].*?["'])?(?:\s+negative=["'].*?["'])?\]/gi, "")
          .replace(/\[ACTION:RUN_WORKFLOW\]/gi, "")
          .replace(/\[OPTIONS:\s*.*?\]/gi, "")
          .trim();

        const unsupportedCompletionClaim = /\b(generation complete|image rendering complete|rendered successfully|now displayed below|processing your request to edit)\b/i.test(acc);
        if (unsupportedCompletionClaim) {
          cleanText = generationRequested
            ? "The model's progress claim is unverified. ComfyUI reports execution status only after a confirmed run."
            : "The model reported a generation status, but no ComfyUI job was started. No edit has been confirmed.";
        }

        out.innerHTML = "";
        if (cleanText) {
          const textNode = document.createElement("div");
          textNode.textContent = cleanText;
          out.appendChild(textNode);
        }

        if (optionChips.length > 0 && activeConfig.interactive_options !== false) {
          const chipWrap = document.createElement("div");
          chipWrap.className = "ca-options-box";
          for (const opt of optionChips) {
            const btn = document.createElement("button");
            btn.className = "ca-option-chip";
            btn.textContent = opt;
            btn.onclick = () => {
              box.value = opt;
              send();
            };
            chipWrap.appendChild(btn);
          }
          out.appendChild(chipWrap);
        }

        // 1. Apply Resolution Change if requested
        if (resMatch && !(orchestrationPlan.status === "ready" && generationRequested)) {
          const reqW = resMatch[1];
          const reqH = resMatch[2];
          const reqAspect = (resMatch[3] || "").toLowerCase();
          const resResult = setCanvasResolution(reqW, reqH, reqAspect);
          const badge = document.createElement("div");
          badge.className = "ca-action-badge";
          badge.innerHTML = resResult.success
            ? `📐 Action: Resolution updated on canvas (${resResult.details})`
            : `⚠️ Action: Resolution change failed: ${resResult.error}`;
          out.prepend(badge);
        }

        // 2. Apply Sampler Change if requested
        if (samplerMatch) {
          const sSteps = samplerMatch[1];
          const sCfg = samplerMatch[2];
          const sDenoise = samplerMatch[3];
          const sSampler = samplerMatch[4];
          const sScheduler = samplerMatch[5];
          setCanvasSampler({ steps: sSteps, cfg: sCfg, denoise: sDenoise, sampler_name: sSampler, scheduler: sScheduler });
          const badge = document.createElement("div");
          badge.className = "ca-action-badge";
          badge.innerHTML = `⚙ Action: Sampler updated (steps: ${sSteps || "-"}, cfg: ${sCfg || "-"}, denoise: ${sDenoise || "-"})`;
          out.prepend(badge);
        }

        if (["unavailable", "incompatible", "needs_choice", "needs_input", "planner_error"].includes(orchestrationPlan.status)) {
          const routeEl = document.createElement("div");
          routeEl.className = "ca-err";
          routeEl.textContent = orchestrationPlan.message || "The orchestrator could not select a workflow.";
          out.appendChild(routeEl);
          if (orchestrationPlan.status === "needs_choice" && orchestrationPlan.choices?.length) {
            const choices = document.createElement("div");
            choices.className = "ca-options-box";
            for (const choice of orchestrationPlan.choices) {
              const button = document.createElement("button");
              button.className = "ca-option-chip";
              button.textContent = choice.name;
              button.onclick = () => { box.value = `Use ${choice.name} to ${text}`; send(); };
              choices.appendChild(button);
            }
            out.appendChild(choices);
          } else if (orchestrationPlan.status === "unavailable" && orchestrationPlan.candidates?.length) {
            const alternatives = orchestrationPlan.candidates.filter((candidate) => candidate.available && candidate.task === orchestrationPlan.intent).slice(0, 3);
            if (alternatives.length) {
              const label = document.createElement("div");
              label.className = "ca-img-meta";
              label.textContent = "Available alternatives:";
              out.appendChild(label);
              const choices = document.createElement("div");
              choices.className = "ca-options-box";
              for (const candidate of alternatives) {
                const button = document.createElement("button");
                button.className = "ca-option-chip";
                button.textContent = candidate.name;
                button.onclick = () => { box.value = `Use ${candidate.name} for this request: ${text}`; send(); };
                choices.appendChild(button);
              }
              out.appendChild(choices);
            }
          }
        } else if (orchestrationPlan.status === "ready" && generationRequested) {
          const prompt = orchestratorAction?.prompt || genMatch?.[1] || "";
          const action = {
            prompt,
            negative_prompt: orchestratorAction?.negative_prompt || "",
          };
          const routeBadge = document.createElement("div");
          routeBadge.className = "ca-action-badge";
          const selectedModel = orchestrationPlan.models?.[0];
          routeBadge.textContent = `🧭 Routed to ${orchestrationPlan.skill_name}${selectedModel ? ` · ${selectedModel}` : ""}`;
          out.prepend(routeBadge);
          if (orchestrationPlan.route_reason) {
            const rationale = document.createElement("div");
            rationale.className = "ca-img-meta";
            rationale.textContent = orchestrationPlan.route_reason;
            out.appendChild(rationale);
          }
          const otherCandidates = (orchestrationPlan.candidates || []).filter((candidate) => !candidate.selected).slice(0, 3);
          if (otherCandidates.length) {
            const alternatives = document.createElement("div");
            alternatives.className = "ca-img-meta";
            alternatives.textContent = `Other registered skills: ${otherCandidates.map((candidate) => `${candidate.name}${candidate.available ? "" : " (workflow unavailable)"}`).join(" · ")}`;
            out.appendChild(alternatives);
          }
          if (!prompt.trim()) {
            const statusEl = document.createElement("div");
            out.appendChild(statusEl);
            statusEl.innerHTML = `<div class="ca-err">The planner selected ${orchestrationPlan.skill_name}, but the model did not return a usable generation prompt. No workflow was queued.</div>`;
          } else {
            const preflightEl = document.createElement("div");
            preflightEl.className = "ca-status-bar";
            preflightEl.textContent = "Checking available GPU memory, installed models, and workflow settings…";
            out.appendChild(preflightEl);
            log.scrollTop = log.scrollHeight;
            try {
              const preflightRes = await fetch("/superagent/preflight", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan: orchestrationPlan, request: text }),
              });
              const preflightData = await preflightRes.json();
              if (!preflightRes.ok) throw new Error(preflightData.error || "Preflight failed");
              const report = preflightData.preflight;
              preflightEl.className = report.can_proceed ? "ca-options-box" : "ca-err";
              preflightEl.replaceChildren();
              const summary = document.createElement("div");
              const machine = report.machine || {};
              const gpuSummary = machine.cuda_available
                ? `${machine.gpu || "CUDA GPU"}${machine.vram_free_gb == null ? "" : ` · ${machine.vram_free_gb} GB VRAM free of ${machine.vram_total_gb} GB`}`
                : "CUDA GPU not detected";
              summary.textContent = `Preflight · ${report.skill_name}: ${report.mode} Recommended size: ${report.resolution.width}×${report.resolution.height}. ${gpuSummary}.`;
              preflightEl.appendChild(summary);
              if (report.warnings?.length) {
                const warning = document.createElement("div");
                warning.textContent = report.warnings.join(" ");
                warning.style.color = "#ffb454";
                preflightEl.appendChild(warning);
              }
              if (machine.ram_total_gb != null) {
                const ram = document.createElement("div");
                ram.textContent = `System RAM: ${machine.ram_total_gb} GB. Model files indexed: ${Object.values(report.model_inventory || {}).reduce((a, b) => a + b, 0)}.`;
                preflightEl.appendChild(ram);
              }
              let identitySelect = null;
              if (report.selected_lora) orchestrationPlan.selected_lora = report.selected_lora;
              if (orchestrationPlan.lora_required && !report.selected_lora) {
                const label = document.createElement("label");
                label.textContent = "Identity LoRA (choose the installed identity matching this person): ";
                identitySelect = document.createElement("select");
                identitySelect.style.cssText = "background:#181818;color:#eee;border:1px solid #555;border-radius:4px;padding:5px;max-width:100%;";
                const placeholder = document.createElement("option");
                placeholder.value = "";
                placeholder.textContent = "Select Krea identity LoRA";
                identitySelect.appendChild(placeholder);
                for (const name of report.identity_loras || []) {
                  const option = document.createElement("option");
                  option.value = name;
                  option.textContent = name;
                  identitySelect.appendChild(option);
                }
                label.appendChild(identitySelect);
                preflightEl.appendChild(label);
                const note = document.createElement("div");
                note.textContent = "These LoRAs encode specific identities. Choose only a matching identity; there is no generic identity LoRA.";
                note.style.color = "#aaa";
                preflightEl.appendChild(note);
              } else if (report.selected_lora) {
                const note = document.createElement("div");
                note.textContent = `Krea Identity Edit LoRA: ${report.selected_lora}`;
                note.style.color = "#aaa";
                preflightEl.appendChild(note);
              }
              if (report.can_proceed) {
                const proceed = document.createElement("button");
                proceed.className = "ca-option-chip";
                proceed.textContent = "Load workflow and queue";
                if (identitySelect) {
                  proceed.disabled = true;
                  proceed.textContent = report.identity_loras?.length ? "Choose identity LoRA first" : "Identity LoRA unavailable";
                  identitySelect.addEventListener("change", () => {
                    proceed.disabled = !identitySelect.value;
                    proceed.textContent = identitySelect.value ? "Load workflow and queue" : "Choose identity LoRA first";
                  });
                }
                proceed.onclick = async () => {
                  if (identitySelect) {
                    if (!identitySelect.value) return;
                    orchestrationPlan.selected_lora = identitySelect.value;
                  }
                  proceed.disabled = true;
                  proceed.textContent = "Preparing workflow…";
                  const statusEl = document.createElement("div");
                  preflightEl.appendChild(statusEl);
                  const activeNodes = app.graph?._nodes || [];
                  const activeWorkflowMatches = wfSel.value === orchestrationPlan.workflow_id;
                  const activeEditCompatible = orchestrationPlan.intent === "image_edit" &&
                    activeNodes.some((node) => node.type === "LoadImage") &&
                    activeNodes.some((node) => node.type === "KSampler") &&
                    activeNodes.some((node) => node.type === "LoraLoaderModelOnly") &&
                    activeNodes.some((node) => node.type === "ImageScale") &&
                    activeNodes.some((node) => node.type === "UNETLoader" && String(node.widgets?.[0]?.value || "").toLowerCase().includes("krea2"));
                  const useActiveGraph = activeWorkflowMatches || activeEditCompatible;
                  statusEl.innerHTML = `<div class="ca-status-bar"><span class="ca-spinner">⚙</span> ${useActiveGraph ? "Using the compatible active edit workflow…" : `Loading ${orchestrationPlan.workflow_name}...`}</div>`;
                  const loaded = useActiveGraph || await loadWorkflowByName(orchestrationPlan.workflow_id);
                  if (!loaded) {
                    statusEl.innerHTML = `<div class="ca-err">Could not load ${orchestrationPlan.workflow_name}. Nothing was queued.</div>`;
                    proceed.disabled = false;
                    proceed.textContent = "Retry";
                    return;
                  }
                  wfSel.value = orchestrationPlan.workflow_id;
                  if (report.resolution?.apply) {
                    const resized = setCanvasResolution(report.resolution.width, report.resolution.height);
                    if (!resized.success) {
                      statusEl.textContent = `The selected workflow has no editable resolution input, so ${report.resolution.width}×${report.resolution.height} could not be applied. Nothing was queued.`;
                      return;
                    }
                  }
                  const inputs = applyOrchestrationInputs(orchestrationPlan, action, routingAttachments);
                  if (!inputs.ok) {
                    statusEl.textContent = `${inputs.error} The workflow was loaded but not queued.`;
                    return;
                  }
                  proceed.remove();
                  await executeGeneration(null, statusEl);
                };
                preflightEl.appendChild(proceed);
              } else {
                const blocked = document.createElement("div");
                blocked.textContent = "Queue blocked because required model files are missing. Install them or choose another workflow.";
                preflightEl.appendChild(blocked);
              }
            } catch (preflightError) {
              preflightEl.className = "ca-err";
              preflightEl.textContent = `Preflight could not verify this run: ${preflightError.message}. Nothing was queued.`;
            }
          }
        } else if (orchestrationPlan.status === "active_canvas") {
          const statusEl = document.createElement("div");
          statusEl.innerHTML = `<div class="ca-status-bar"><span class="ca-spinner">⚙</span> Running the active canvas workflow by request...</div>`;
          out.appendChild(statusEl);
          await executeGeneration(null, statusEl);
        } else if (["chat", "advice"].includes(orchestrationPlan.status) && generationRequested && !(orchestrationPlan.status === "advice" && genMatch && /(?:need|give|write|get|show|create|extract)\s+(?:a\s+)?prompt\b|describe\s+(?:this|the)?\s*image|what\s+is\s+the\s+prompt/i.test(text))) {
          const routeEl = document.createElement("div");
          const asksForVideo = /\b(video|clip|animation|animate|t2v|i2v)\b/i.test(planningText);
          const asksForEdit = routingAttachments.length > 0 || /\b(edit|change|replace|remove|restyle|inpaint|outpaint|transform|sit|stand|place|move|put)\b/i.test(planningText);
          const tasks = asksForVideo
            ? (routingAttachments.length ? ["image_to_video", "text_to_video"] : ["text_to_video"])
            : asksForEdit ? ["image_edit", "image_with_references"] : ["text_to_image"];
          const suggestions = availableSkills.filter((skill) => skill.available && tasks.includes(skill.task)).slice(0, 4);
          routeEl.className = suggestions.length ? "ca-bot" : "ca-img-meta";
          routeEl.textContent = suggestions.length
            ? "I can help with that. Which workflow would you like me to use?"
            : "I can answer questions and help plan the result. To generate it, choose a workflow from the menu or tell me which model to use.";
          out.appendChild(routeEl);
          if (suggestions.length) {
            const choices = document.createElement("div");
            choices.className = "ca-options-box";
            for (const skill of suggestions) {
              const button = document.createElement("button");
              button.className = "ca-option-chip";
              button.textContent = skill.name;
              button.onclick = () => {
                box.value = `Use ${skill.name} for this request: ${planningText}`;
                send();
              };
              choices.appendChild(button);
            }
            const activeButton = document.createElement("button");
            activeButton.className = "ca-option-chip";
            activeButton.textContent = "Use active workflow";
            activeButton.onclick = () => { box.value = `Use the active workflow for this request: ${planningText}`; send(); };
            choices.appendChild(activeButton);
            out.appendChild(choices);
          }
        } else if (orchestrationPlan.status === "ready" && !generationRequested && ["text_to_image", "image_edit", "text_to_video", "image_to_video", "image_with_references"].includes(orchestrationPlan.intent)) {
          const routeEl = document.createElement("div");
          routeEl.className = "ca-err";
          routeEl.textContent = `The ${orchestrationPlan.skill_name} workflow is available, but the model did not return a runnable action. Nothing was queued.`;
          out.appendChild(routeEl);
        } else if (orchestratorAction?.type === "edit_image") {
          const statusEl = document.createElement("div");
          statusEl.textContent = "This edit action did not receive a validated workflow plan, so nothing was queued.";
          out.appendChild(statusEl);
        } else if (loadMatch) {
          const statusEl = document.createElement("div");
          out.appendChild(statusEl);
          log.scrollTop = log.scrollHeight;
          if (!routingAttachments[0]?.name) {
            statusEl.innerHTML = `<div class="ca-err">This edit action needs an image attached to the current message. Upload the source image and try again.</div>`;
          } else {
            statusEl.innerHTML = `<div class="ca-status-bar"><span class="ca-spinner">⚙</span> Preparing the image edit workflow...</div>`;
            const loaded = await loadWorkflowByName("template_krea2_i2i");
            if (!loaded) {
              statusEl.innerHTML = `<div class="ca-err">Could not load the bundled image-to-image workflow.</div>`;
            } else if (!setWorkflowImage(routingAttachments[0].name)) {
              statusEl.innerHTML = `<div class="ca-err">The image-to-image workflow has no usable LoadImage input.</div>`;
            } else {
              const { positiveNode } = findPromptNodes();
              if (!setNodePromptText(positiveNode, editAction.prompt)) {
                statusEl.innerHTML = `<div class="ca-err">Could not find the positive prompt input in the image-to-image workflow.</div>`;
              } else {
                await executeGeneration(null, statusEl);
              }
            }
          }
        } else if (loadMatch) {
          const wfName = loadMatch[1];
          const promptToRun = loadMatch[2];
          const badge = document.createElement("div");
          badge.className = "ca-action-badge";
          badge.innerHTML = `⚡ Action: Load Workflow "${wfName}"`;
          out.prepend(badge);

          const statusEl = document.createElement("div");
          statusEl.innerHTML = `<div class="ca-status-bar"><span class="ca-spinner">⚙</span> Loading "${wfName}" onto canvas...</div>`;
          out.appendChild(statusEl);
          log.scrollTop = log.scrollHeight;

          const ok = await loadWorkflowByName(wfName);
          if (ok) {
            statusEl.innerHTML = `<div class="ca-status-bar">✅ Workflow "${wfName}" loaded on canvas.</div>`;
            if (promptToRun) {
              await executeGeneration(promptToRun, statusEl);
            }
          } else {
            statusEl.innerHTML = `<div class="ca-err">❌ Could not find or load workflow "${wfName}".</div>`;
          }
        } else if (genMatch && orchestrationPlan.status !== "ready") {
          const promptToRun = genMatch[1];
          // Check if user's prompt was asking for a prompt or description (NOT asking to generate)
          const isPromptOnlyRequest = /(?:need|give|write|get|show|create|extract)\s+(?:a\s+)?prompt\b/i.test(text) ||
                                      /(?:describe|analyze|explain)\s+(?:this|the)?\s*image/i.test(text) ||
                                      /(?:what\s+is\s+the\s+prompt|prompt\s+for\s+this)/i.test(text);

          if (isPromptOnlyRequest) {
            // User requested a prompt, not an immediate image generation!
            const badge = document.createElement("div");
            badge.className = "ca-action-badge";
            badge.innerHTML = "📝 Action: Prompt crafted for image (Click below to apply or generate)";
            out.prepend(badge);

            const card = document.createElement("div");
            card.className = "ca-prompt-action-card";
            card.style.cssText = "margin-top:8px;padding:8px;background:#242424;border:1px solid #444;border-radius:6px;display:flex;gap:6px;flex-wrap:wrap;";

            const applyBtn = document.createElement("button");
            applyBtn.className = "ca-option-chip";
            applyBtn.textContent = "✅ Set as Canvas Prompt";
            applyBtn.onclick = () => {
              const { positiveNode } = findPromptNodes();
              if (positiveNode) {
                setNodePromptText(positiveNode, promptToRun);
                add("ca-bot", "✅ Prompt applied to canvas positive prompt node.");
              }
            };

            const runBtn = document.createElement("button");
            runBtn.className = "ca-option-chip";
            runBtn.textContent = "⚡ Generate Image Now";
            runBtn.onclick = async () => {
              const statusEl = document.createElement("div");
              out.appendChild(statusEl);
              log.scrollTop = log.scrollHeight;
              await executeGeneration(promptToRun, statusEl);
            };

            card.appendChild(applyBtn);
            card.appendChild(runBtn);
            out.appendChild(card);
          } else {
            const badge = document.createElement("div");
            badge.className = "ca-action-badge";
            badge.innerHTML = "⚡ Action: Generate Image";
            out.prepend(badge);

            const statusEl = document.createElement("div");
            out.appendChild(statusEl);
            log.scrollTop = log.scrollHeight;

            await executeGeneration(promptToRun, statusEl);
          }
        } else if (setMatch) {
          const pos = setMatch[1], neg = setMatch[2];
          const { positiveNode, negativeNode } = findPromptNodes();
          if (pos && positiveNode) setNodePromptText(positiveNode, pos);
          if (neg && negativeNode) setNodePromptText(negativeNode, neg);

          const badge = document.createElement("div");
          badge.className = "ca-action-badge";
          badge.innerHTML = "✅ Action: Prompts Updated on Canvas";
          out.prepend(badge);
        } else if (runMatch) {
          const badge = document.createElement("div");
          badge.className = "ca-action-badge";
          badge.innerHTML = "⚡ Action: Running Canvas Workflow";
          out.prepend(badge);

          const statusEl = document.createElement("div");
          out.appendChild(statusEl);
          log.scrollTop = log.scrollHeight;

          await executeGeneration(null, statusEl);
        }
      }
    } catch (e) {
      out.classList.add("ca-err");
      out.textContent = e.message;
    }
    busy = false; sendBtn.disabled = false; box.focus();
  }

  sendBtn.onclick = send;
  for (const ev of ["keydown", "keyup", "keypress"]) {
    box.addEventListener(ev, (e) => e.stopPropagation());
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
  loadWorkflowsList();
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
      ui.h = clamp(ui.h, 300, innerHeight - 16);
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

  function applyLauncherPosition() {
    if (ui.launcherX == null || ui.launcherY == null) {
      launcher.style.right = "20px";
      launcher.style.bottom = "20px";
      launcher.style.left = "auto";
      launcher.style.top = "auto";
    } else {
      ui.launcherX = clamp(ui.launcherX, 0, innerWidth - 56);
      ui.launcherY = clamp(ui.launcherY, 0, innerHeight - 56);
      launcher.style.left = ui.launcherX + "px";
      launcher.style.top = ui.launcherY + "px";
      launcher.style.right = "auto";
      launcher.style.bottom = "auto";
    }
  }

  // Draggable launcher icon (⚡)
  let launcherMoved = false;
  let lStartX = 0, lStartY = 0;
  let lInitX = 0, lInitY = 0;

  launcher.addEventListener("pointerdown", (e) => {
    launcherMoved = false;
    lStartX = e.clientX;
    lStartY = e.clientY;
    const rect = launcher.getBoundingClientRect();
    lInitX = rect.left;
    lInitY = rect.top;
    launcher.setPointerCapture(e.pointerId);

    const onMove = (ev) => {
      const dx = ev.clientX - lStartX;
      const dy = ev.clientY - lStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        launcherMoved = true;
      }
      ui.launcherX = lInitX + dx;
      ui.launcherY = lInitY + dy;
      applyLauncherPosition();
    };

    const onUp = (ev) => {
      launcher.removeEventListener("pointermove", onMove);
      launcher.removeEventListener("pointerup", onUp);
      try { launcher.releasePointerCapture(ev.pointerId); } catch {}
      if (launcherMoved) {
        save();
      } else {
        ui.open = !ui.open;
        save();
        apply();
      }
    };

    launcher.addEventListener("pointermove", onMove);
    launcher.addEventListener("pointerup", onUp);
  });

  win.querySelector(".sa-close").onclick = () => { ui.open = false; save(); apply(); };
  dockBtn.onclick = () => { ui.mode = ui.mode === "dock" ? "float" : "dock"; save(); apply(); };
  addEventListener("resize", () => {
    apply();
    applyLauncherPosition();
  });

  // drag (float mode, or auto-undock when dragging header from dock mode)
  head.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    if (ui.mode === "dock") {
      ui.mode = "float";
      ui.w = clamp(ui.dockW, 320, innerWidth - 16);
      ui.x = clamp(e.clientX - 120, 0, innerWidth - ui.w);
      ui.y = clamp(e.clientY - 20, 0, innerHeight - 100);
      save();
      apply();
    }
    const dx = e.clientX - ui.x, dy = e.clientY - ui.y;
    head.setPointerCapture(e.pointerId);
    const move = (ev) => { ui.x = ev.clientX - dx; ui.y = ev.clientY - dy; apply(); };
    const up = (ev) => {
      head.removeEventListener("pointermove", move);
      head.removeEventListener("pointerup", up);
      try { head.releasePointerCapture(ev.pointerId); } catch {}
      save();
    };
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

  // native corner-resize (float mode)
  let t;
  new ResizeObserver(() => {
    if (!ui.open || ui.mode !== "float") return;
    const w = win.offsetWidth, h = win.offsetHeight;
    if (w === ui.w && h === ui.h) return;
    ui.w = w; ui.h = h;
    clearTimeout(t); t = setTimeout(save, 300);
  }).observe(win);

  applyLauncherPosition();
  apply();
}

app.registerExtension({
  name: "nodex.superagent.panel",
  async setup() {
    createUI();
  },
});

