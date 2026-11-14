// app.js — wiring. Local only: no network requests after page load.

import { loadAllRows, exportJSON, clearAll } from "./storage.js";
import { importFiles } from "./import.js";
import { buildSeries, renderChart, setEmptyState } from "./chart-render.js";
import { loadSelection, saveSelection, renderAnalyteList, setStatus } from "./ui.js";
import { analyteColor } from "./normalize.js";

const canvas = document.getElementById("chart");
const analyteList = document.getElementById("analyte-list");
const fileInput = document.getElementById("file-input");
const exportBtn = document.getElementById("export-btn");

let chart = null;
let visible = new Set();

function collectAnalytes(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!r.analyteId) continue;
    if (!map.has(r.analyteId)) {
      map.set(r.analyteId, { label: r.analyteLabel, count: 0, plottable: false });
    }
    const a = map.get(r.analyteId);
    a.count++;
    // Plottable = at least one row has a numeric max greater than its min
    // (stray unparseable rows, e.g. qualitative urine lines, must not grey
    // out an analyte whose other rows chart fine).
    if (r.refHighN !== null && r.refHighN > (r.refLowN ?? 0)) a.plottable = true;
  }
  return map;
}

async function refresh() {
  const rows = await loadAllRows();
  const analytes = collectAnalytes(rows);
  renderAnalyteList(analyteList, analytes, visible, onSelectionChange);
  const countEl = document.getElementById("sel-count");
  if (countEl) countEl.textContent = `${visible.size} selected`;
  const series = buildSeries(rows, visible);
  series.forEach((s) => { s.color = analyteColor(s.id); });
  if (chart) chart.destroy();
  chart = renderChart(canvas, series);
  setEmptyState(canvas, series.length === 0);
  const files = new Set(rows.map((r) => r.file)).size;
  setStatus(
    `${rows.length} measurements, ${analytes.size} analytes, ${files} report(s) loaded.`
  );
}

async function onSelectionChange(newVisible) {
  visible = newVisible;
  await saveSelection(visible);
  await refresh();
}

fileInput.addEventListener("change", async () => {
  const files = [...fileInput.files];
  fileInput.value = "";
  if (!files.length) return;
  setStatus(`Importing ${files.length} file(s)...`);
  const res = await importFiles(files);
  const parts = [];
  if (res.added) parts.push(`${res.added} new report(s)`);
  if (res.replaced) parts.push(`${res.replaced} replaced`);
  // unusable rows are expected (urine sediment etc.) — a quiet note, not an error
  if (res.skipped.length) {
    const byFile = new Map();
    for (const s of res.skipped) byFile.set(s.file, (byFile.get(s.file) || 0) + 1);
    parts.push(`skipped ${res.skipped.length} unusable row(s) `
      + [...byFile].map(([f, n]) => `${f}: ${n}`).join(", "));
    console.log("Skipped rows (kept locally in console only):",
      res.skipped.map((s) => `${s.file}: "${s.test}" ${s.reason}`));
  }
  if (res.errors.length) {
    setStatus(`Imported ${parts.join(", ") || "nothing"}. Errors:\n` + res.errors.join("\n"), true);
  } else {
    setStatus(`Imported ${parts.join(", ")}.`);
  }
  // ensure at least the default view on first import
  if (!visible.size) visible = new Set(["hemoglobin"]);
  await refresh();
});

exportBtn.addEventListener("click", () => exportJSON().then(() =>
  setStatus("Export downloaded (saved locally, not uploaded).")));

document.getElementById("unselect-all").addEventListener("click", async (e) => {
  e.stopPropagation(); // mobile: the panel head is also a collapse toggle
  visible.clear();
  await saveSelection(visible);
  await refresh();
  setStatus("Selection cleared.");
});

// Mobile: the panel header bar collapses/expands the chip area.
document.querySelector(".panel-head").addEventListener("click", () => {
  document.getElementById("analyte-panel").classList.toggle("collapsed");
});

// Wipes the local IndexedDB (results + settings). Irreversible — the browser
// copy is gone; re-import PDFs or import a JSON export to restore.
document.getElementById("delete-data").addEventListener("click", async () => {
  const ok = window.confirm(
    "Delete ALL locally stored measurements and settings?\n\n"
    + "This only clears this browser's database — nothing is uploaded anywhere. "
    + "Export first if you want a local backup."
  );
  if (!ok) return;
  await clearAll();
  visible.clear();
  await refresh();
  setStatus("All local data deleted.");
});

document.getElementById("toggle-detail").addEventListener("click", (e) => {
  e.preventDefault();
  const d = document.getElementById("privacy-detail");
  d.hidden = !d.hidden;
});

async function init() {
  visible = await loadSelection();
  await refresh();
}

init();
