// ui.js — analyte selection panel. Desktop: vertical checkbox list.
// Mobile (<=820px): same elements become a horizontal chip scroller (CSS).

import { analyteColor, analyteLabel, GROUPS, analyteGroup } from "./normalize.js";
import { analyteDescription } from "./descriptions.js";
import { getSetting, setSetting } from "./storage.js";

const DEFAULT_VISIBLE = new Set(["hemoglobin"]);

export async function loadSelection() {
  const saved = await getSetting("selection", null);
  if (saved) return new Set(Object.keys(saved).filter((k) => saved[k]));
  return new Set(DEFAULT_VISIBLE);
}

export function saveSelection(visible) {
  const obj = {};
  for (const id of visible) obj[id] = true;
  return setSetting("selection", obj);
}

// One shared hover popup for all (i) buttons, fixed-positioned so scroll
// containers (mobile chip scroller) can't clip it.
let infoPopup = null;
let infoPopupFor = null;
let infoOpenVia = ""; // "hover" or "click" — touch fires mouseenter then click

function showInfo(btn, id, via = "hover") {
  infoOpenVia = via;
  const desc = analyteDescription(id);
  if (!desc) return;
  if (!infoPopup) {
    infoPopup = document.createElement("div");
    infoPopup.className = "info-popup";
    document.body.appendChild(infoPopup);
  }
  const name = btn.dataset.name || "";
  infoPopup.innerHTML = "";
  if (name) {
    const t = document.createElement("strong");
    t.textContent = name;
    infoPopup.appendChild(t);
  }
  const p = document.createElement("p");
  p.textContent = desc;
  infoPopup.appendChild(p);
  const src = document.createElement("span");
  src.className = "info-src";
  src.textContent = "Forrás: Wikipédia";
  infoPopup.appendChild(src);

  const r = btn.getBoundingClientRect();
  const above = r.top > 240;
  infoPopup.classList.toggle("above", above);
  // measure after content, then clamp horizontally to the viewport
  const w = Math.min(320, window.innerWidth - 16);
  const x = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8));
  infoPopup.style.left = x + "px";
  infoPopup.style.top = above ? "" : r.bottom + 8 + "px";
  infoPopup.style.bottom = above ? window.innerHeight - r.top + 8 + "px" : "";
  infoPopup.style.width = w + "px";
  infoPopup.hidden = false;
  infoPopupFor = btn;
}

function hideInfo() {
  if (infoPopup) infoPopup.hidden = true;
  infoPopupFor = null;
}

// Close the popup on scroll / click elsewhere / Escape.
window.addEventListener("scroll", () => {
  if (infoPopup && !infoPopup.hidden) {
    if (infoPopupFor) showInfo(infoPopupFor, infoPopupFor.dataset.id);
  }
}, true);
window.addEventListener("click", (e) => {
  if (infoPopup && !infoPopup.hidden && !infoPopup.contains(e.target)
      && !(infoPopupFor && infoPopupFor.contains(e.target))) hideInfo();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideInfo();
});

/**
 * Render the analyte list, grouped by lab panel.
 * analytes: Map<analyteId, {label, count, plottable}>
 * visible: Set of selected ids
 * onChange(visible) called after every toggle.
 * Group headers toggle all analytes in the group.
 */
export function renderAnalyteList(container, analytes, visible, onChange) {
  container.innerHTML = "";

  const byGroup = new Map();
  for (const [id, info] of analytes) {
    const gid = analyteGroup(id);
    if (!byGroup.has(gid)) byGroup.set(gid, []);
    byGroup.get(gid).push([id, info]);
  }
  const order = [...GROUPS.map((g) => g[0]), "other"];
  const groupLabel = (gid) =>
    gid === "other" ? "Egyéb" : (GROUPS.find((g) => g[0] === gid)?.[1] ?? gid);

  for (const gid of order) {
    const items = byGroup.get(gid);
    if (!items) continue;
    const group = document.createElement("div");
    group.className = "group";

    const h = document.createElement("h3");
    h.textContent = groupLabel(gid);
    h.title = "Click to toggle the whole group";
    h.addEventListener("click", () => {
      const ids = items.map(([id]) => id);
      // toggle: select all plottable if none/partial selected, else clear
      const anyOn = ids.some((id) => visible.has(id));
      for (const id of ids) {
        if (anyOn) visible.delete(id);
        else if (analytes.get(id).plottable) visible.add(id);
      }
      onChange(visible);
    });
    group.appendChild(h);

    for (const [id, info] of items.sort((a, b) =>
      a[1].label.localeCompare(b[1].label))) {
      const color = analyteColor(id);
      const label = document.createElement("label");
      label.className = "analyte" + (info.plottable ? "" : " unavailable");
      label.style.color = color;
      label.title = info.plottable
        ? `${info.count} measurement(s)`
        : "No numeric reference interval — cannot be normalized";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = visible.has(id) && info.plottable;
      cb.disabled = !info.plottable;
      cb.addEventListener("change", () => {
        if (cb.checked) visible.add(id);
        else visible.delete(id);
        onChange(visible);
      });

      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = color;

      const text = document.createElement("span");
      text.textContent = analyteLabel(id);

      // (i) info button — hover/click opens a short Wikipedia-based summary
      const infoBtn = document.createElement("button");
      infoBtn.type = "button";
      infoBtn.className = "info";
      infoBtn.textContent = "i";
      infoBtn.dataset.id = id;
      infoBtn.dataset.name = analyteLabel(id);
      infoBtn.title = "Rövid leírás";
      infoBtn.setAttribute("aria-label", `${analyteLabel(id)} leírása`);
      infoBtn.addEventListener("mouseenter", () => showInfo(infoBtn, id, "hover"));
      infoBtn.addEventListener("mouseleave", () => {
        if (infoPopupFor === infoBtn) hideInfo();
      });
      infoBtn.addEventListener("focus", () => showInfo(infoBtn, id, "hover"));
      infoBtn.addEventListener("blur", () => {
        if (infoPopupFor === infoBtn) hideInfo();
      });
      infoBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        // touch: mouseenter already opened it ("hover") — keep it, mark as
        // click-opened; the next tap (click-opened) closes it. Desktop mouse
        // users just hover, so this rarely fires.
        if (infoPopupFor === infoBtn && !infoPopup.hidden && infoOpenVia === "click") {
          hideInfo();
        } else {
          showInfo(infoBtn, id, "click");
        }
      });

      label.append(cb, dot, text, infoBtn);
      group.appendChild(label);
    }
    container.appendChild(group);
  }
}

export function setStatus(msg, isError = false) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.style.color = isError ? "var(--danger)" : "var(--muted)";
}
