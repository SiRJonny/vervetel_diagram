// ui.js — analyte selection panel. Desktop: vertical checkbox list.
// Mobile (<=820px): same elements become a horizontal chip scroller (CSS).

import { analyteColor, analyteLabel, GROUPS, analyteGroup } from "./normalize.js";
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
      const allOn = ids.every((id) => visible.has(id));
      for (const id of ids) {
        if (allOn) visible.delete(id);
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

      label.append(cb, dot, text);
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
