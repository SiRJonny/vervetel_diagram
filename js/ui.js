// ui.js — analyte selection panel. Desktop: vertical checkbox list.
// Mobile (<=820px): same elements become a horizontal chip scroller (CSS).

import { analyteColor, analyteLabel } from "./normalize.js";
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

/**
 * Render the analyte list.
 * analytes: Map<analyteId, {label, count, plottable}>
 * visible: Set of selected ids
 * onChange(visible) called after every toggle.
 */
export function renderAnalyteList(container, analytes, visible, onChange) {
  container.innerHTML = "";
  for (const [id, info] of [...analytes.entries()].sort((a, b) =>
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

    label.append(cb, dot, text);
    container.appendChild(label);
  }
}

export function setStatus(msg, isError = false) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.style.color = isError ? "var(--danger)" : "var(--muted)";
}
