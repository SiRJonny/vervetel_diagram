// app.js — wiring. Local only: no network requests after page load.

import { loadAllRows, exportJSON } from "./storage.js";
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
      map.set(r.analyteId, { label: r.analyteLabel, count: 0, plottable: true });
    }
    const a = map.get(r.analyteId);
    a.count++;
    if (r.refLowN === null || r.refHighN === null
      || r.refHighN <= r.refLowN) a.plottable = false;
  }
  return map;
}

async function refresh() {
  const rows = await loadAllRows();
  const analytes = collectAnalytes(rows);
  renderAnalyteList(analyteList, analytes, visible, onSelectionChange);
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
