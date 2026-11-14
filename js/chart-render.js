// chart-render.js — normalized multi-analyte time chart.
//
// Every visible series is scaled so that its own reference interval
// (refLow..refHigh) maps onto a fixed common band (BAND_LOW..BAND_HIGH)
// on the shared y axis. Two dashed horizontal lines mark that band.
// Each series' actual interval values are shown as colored labels on the
// right edge (landscape only; portrait users tap a point for the tooltip).
// Clicking/tapping a plot line selects that series: the dashed band lines
// are annotated with its interval values and its name shows top-right.

import { unitAllowed, FIXED_BANDS, DATA_BANDS } from "./normalize.js";

export const BAND_LOW = 0.2;
export const BAND_HIGH = 0.8;

// Currently selected plot series (analyte id), survives chart re-renders.
// Null = nothing selected.
let selectedId = null;

function fmt(v) {
  if (v === null || v === undefined) return "–";
  const s = String(Math.round(v * 1000) / 1000);
  return s.replace(".", ",");
}

function isoDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Compact x-tick label for portrait: "24.11" — full ISO dates would overlap
// when many datapoints exist; day precision stays available in the tooltip.
function shortDate(ts) {
  const d = new Date(ts);
  return `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Build normalized chart series from enriched, persisted rows.
// rows already have: analyteId, analyteLabel, value, refLowN, refHighN, unit, date, bound
export function buildSeries(rows, visibleIds) {
  const byAnalyte = new Map();
  for (const r of rows) {
    if (!r.analyteId || !visibleIds.has(r.analyteId)) continue;
    if (!byAnalyte.has(r.analyteId)) byAnalyte.set(r.analyteId, []);
    byAnalyte.get(r.analyteId).push(r);
  }

  const series = [];
  for (const [id, allRows] of byAnalyte) {
    // unit guard: drop rows whose unit contradicts the analyte (e.g. urine
    // sediment "/HPF" rows in reports stored before the import-side check).
    // Unitless rows are kept only when the analyte has no unit-bearing rows.
    const unitRows = allRows.filter((r) => unitAllowed(id, r.unit));
    const hasUnits = unitRows.some((r) => r.unit);
    const list = hasUnits
      ? unitRows.filter((r) => r.unit || FIXED_BANDS[id])
      : unitRows;
    if (!list.length) continue;
    // reference interval from the most recent row that carries one — the
    // newest report row may be a value without a range, and a chip must
    // not end up with an empty chart in that case
    const sorted = [...list].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const latest = sorted[sorted.length - 1];

    // latest reference interval, applied to ALL points of the series;
    // 0-min fallback for one-sided references ("< x"); fixed band where the
    // reports only ever give "> x" (eGFR, HDL)
    const fixed = FIXED_BANDS[id];
    let sLo, sHi, oneSided = false;
    if (fixed) {
      sLo = fixed.lo;
      sHi = fixed.hi;
    } else {
      const refRows = sorted.filter(
        (r) => r.refHighN !== null && r.refHighN > (r.refLowN ?? 0));
      if (!refRows.length && DATA_BANDS[id]) {
        // no lab range anywhere — scale by the data's own min/max for now
        const vals = sorted.map((r) => r.value)
          .filter((v) => v !== null && Number.isFinite(v));
        if (!vals.length) continue;
        sLo = Math.min(...vals);
        sHi = Math.max(...vals);
        if (sHi <= sLo) sHi = sLo + Math.max(Math.abs(sLo) * 0.1, 1);
      } else {
        if (!refRows.length) continue; // not plottable
        const refLatest = refRows[refRows.length - 1];
        sLo = refLatest.refLowN;
        sHi = refLatest.refHighN;
        if (sLo === null && sHi !== null) { sLo = 0; oneSided = true; }
        if (sLo === null || sHi === null || sHi <= sLo) continue;
      }
    }

    const y = (v) => BAND_LOW + ((v - sLo) / (sHi - sLo)) * (BAND_HIGH - BAND_LOW);
    const points = sorted
      .map((r) => {
        // ">90" style results are drawn at a fixed representative value
        const v = fixed && fixed.over !== undefined && r.bound === ">"
          ? fixed.over : r.value;
        return {
          x: Date.parse(r.date),
          y: Math.min(1, Math.max(0, y(v))),
          raw: r,
        };
      })
      .filter((p) => !Number.isNaN(p.x))
      .sort((a, b) => a.x - b.x);
    if (!points.length) continue;

    const units = [...new Set(list.map((r) => r.unit).filter(Boolean))];
    const unitStr = units[0] ? " " + units[0] : "";
    // hard guard: a series with contradictory units must never be drawn
    if (units.length > 1) continue;
    series.push({
      id,
      label: latest.analyteLabel,
      unit: units.join(" / "),
      refLow: sLo,
      refHigh: sHi,
      refLabel: oneSided
        ? `< ${fmt(sHi)}${unitStr}`
        : `${fmt(sLo)}–${fmt(sHi)}${unitStr}`,
      mixedUnits: false,
      points,
    });
  }
  return series.sort((a, b) => a.label.localeCompare(b.label));
}

const refBandPlugin = {
  id: "refBand",
  afterDatasetsDraw(chart, args, opts) {
    const { ctx, chartArea: ca, scales: { y } } = chart;
    if (!y || !opts || !opts.labels) return;
    const yLow = y.getPixelForValue(BAND_LOW);
    const yHigh = y.getPixelForValue(BAND_HIGH);

    ctx.save();
    // dashed common interval lines
    ctx.strokeStyle = "rgba(150,160,175,0.55)";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    for (const yy of [yLow, yHigh]) {
      ctx.beginPath();
      ctx.moveTo(ca.left, yy);
      ctx.lineTo(ca.right, yy);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // selected series: annotate the dashed lines with its interval values,
    // centered on each line; series name small in the top-right corner
    const sel = opts.selected;
    if (sel !== null && sel !== undefined) {
      const s = chart.data.datasets[sel]?.series;
      if (s) {
        const cx = (ca.left + ca.right) / 2;
        ctx.font = "13px system-ui";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(223,228,234,0.9)";
        const unit = s.unit ? " " + s.unit : "";
        ctx.fillText(fmt(s.refLow) + unit, cx, yLow + 13);
        ctx.fillText(fmt(s.refHigh) + unit, cx, yHigh - 5);
        ctx.textAlign = "right";
        ctx.fillStyle = s.color || "rgba(139,148,163,0.9)";
        ctx.font = "italic 13px system-ui";
        ctx.fillText(s.label, ca.right - 4, ca.top + 14);
      }
    }

    // few series (3 or less): label every marker with its value and put the
    // series name next to the last marker — with so few lines there is
    // room, and it spares the user from hovering each point
    if (chart.data.datasets.length <= 3) {
      ctx.font = "10px system-ui";
      for (let i = 0; i < chart.data.datasets.length; i++) {
        const ds = chart.data.datasets[i];
        const meta = chart.getDatasetMeta(i);
        if (!meta || !meta.data.length) continue;
        const s = ds.series;
        ctx.fillStyle = s.color || "#dfe4ea";
        for (let k = 0; k < meta.data.length; k++) {
          const el = meta.data[k];
          const row = ds.data[k].raw;
          if (!el || row.value === null || row.value === undefined) continue;
          const text = (row.bound || "") + fmt(row.value);
          if (el.x > ca.right - ctx.measureText(text).width - 12) {
            ctx.textAlign = "right";
            ctx.fillText(text, el.x - 7, el.y + 3.5);
          } else {
            ctx.textAlign = "left";
            ctx.fillText(text, el.x + 7, el.y + 3.5);
          }
        }
        // series name at the last marker, above it (below when clipped)
        const last = meta.data[meta.data.length - 1];
        ctx.font = "italic 10px system-ui";
        ctx.fillStyle = s.color || "#dfe4ea";
        const nameW = ctx.measureText(s.label).width;
        const ny = last.y - 12 > ca.top + 2 ? last.y - 9 : last.y + 13;
        if (last.x - 9 - nameW > ca.left) {
          ctx.textAlign = "right";
          ctx.fillText(s.label, last.x - 9, ny);
        } else {
          ctx.textAlign = "left";
          ctx.fillText(s.label, last.x + 9, ny);
        }
        ctx.font = "10px system-ui";
      }
    }

    if (!opts.labels.length) { ctx.restore(); return; }

    // per-series interval labels, stacked on the right edge
    ctx.textAlign = "left";
    ctx.font = "11px system-ui";
    opts.labels.forEach((l, i) => {
      const ty = ca.top + 16 + i * 15;
      ctx.fillStyle = "rgba(20,23,28,0.75)";
      const w = ctx.measureText(l.text).width + 8;
      ctx.fillRect(ca.right + 6, ty - 10, w, 13);
      ctx.fillStyle = l.color;
      ctx.fillText(l.text, ca.right + 10, ty);
    });
    ctx.restore();
  },
};

export function renderChart(canvas, series) {
  // Selection survives list refreshes (analyte toggles destroy the chart);
  // keyed by analyte id, resolved to an index at render time.
  const datasets = series.map((s) => ({
    label: s.label,
    data: s.points,
    showLine: true,
    borderColor: s.color,
    backgroundColor: s.color,
    // selection style must exist at creation too — otherwise the thickened
    // selected line snaps back to thin on every list-driven re-render
    pointRadius: s.id === selectedId ? 5 : 4,
    pointHoverRadius: 6,
    borderWidth: s.id === selectedId ? 3.5 : 2,
    tension: 0.15,
    pointStyle: "circle",
    series: s, // tooltip reads the series-level (latest) reference
  }));

  const selectedIdx = () => {
    const i = datasets.findIndex((ds) => ds.series.id === selectedId);
    return i >= 0 ? i : null;
  };
  const applySelection = (chart) => {
    chart.data.datasets.forEach((ds) => {
      const sel = ds.series.id === selectedId;
      ds.borderWidth = sel ? 3.5 : 2;
      ds.pointRadius = sel ? 5 : 4;
    });
    chart.options.plugins.refBand.selected = selectedIdx();
    chart.update("none");
  };

  const labels = series.map((s) => ({ color: s.color, text: s.refLabel }));

  // Portrait layout (any screen taller than wide): no right-edge interval
  // labels (they eat too much width); users tap a point and the tooltip
  // shows the reference interval.
  const isPortrait = window.matchMedia("(orientation: portrait)").matches;
  const drawnLabels = isPortrait ? [] : labels;

  // x ticks only at actual datapoint dates (union across visible series)
  const pointDates = [...new Set(
    series.flatMap((s) => s.points.map((p) => p.x)),
  )].sort((a, b) => a - b);

  // Reserve space on the right so the interval labels never get clipped.
  const rightPad = isPortrait ? 8
    : Math.min(200, Math.max(96, Math.round(
        Math.max(10, ...labels.map((l) => l.text.length)) * 7.2) + 18));

  const chart = new Chart(canvas, {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false, // no grow/slide-in when datasets appear
      layout: {
        // Chart.js "auto padding" insets the chart area by the datasets'
        // max point/border overflow, which it reads one update stale —
        // toggling a line's thickness (selection) then shifts the whole
        // layout back and forth (verified in a real browser). Fixed
        // padding instead: the chart area never moves on selection.
        autoPadding: false,
        padding: { left: 8, top: 8, right: rightPad },
      },
      parsing: false,
      normalized: true,
      interaction: { mode: "nearest", intersect: true },
      onClick(e, elements, chart) {
        let idx = elements.length ? elements[0].datasetIndex : null;
        if (idx === null) {
          // touch taps often miss the point radius — fall back to nearest
          const near = chart.getElementsAtEventForMode(e, "nearest",
            { intersect: false }, true);
          idx = near.length ? near[0].datasetIndex : null;
        }
        if (idx === null) return;
        const id = chart.data.datasets[idx].series.id;
        selectedId = selectedId === id ? null : id; // second click deselects
        applySelection(chart);
      },
      scales: {
        x: {
          type: "linear",
          ticks: {
            color: "#8b94a3",
            callback: isPortrait ? shortDate : isoDate,
            maxRotation: 0,
            autoSkip: true,
            // portrait: compact YY.MM labels, fewer of them — they would
            // overlap when many datapoints exist
            maxTicksLimit: isPortrait ? 6 : 12,
          },
          // place a tick at every datapoint date, no dates in between
          afterBuildTicks: (axis) => {
            axis.ticks = pointDates.map((v) => ({ value: v }));
          },
          grid: { color: "rgba(43,50,62,0.6)" },
        },
        y: {
          min: 0,
          max: 1,
          display: false,
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            // exact date here — portrait ticks show only YY.MM
            title: (items) => items.length ? items[0].raw.raw.date : "",
            label: (item) => {
              const raw = item.raw.raw;
              const s = item.dataset.series;
              const ref = s ? ` (ref ${s.refLabel})` : "";
              return `${raw.analyteLabel}: ${raw.bound}${fmt(raw.value)} ${raw.unit || ""}${ref}`;
            },
          },
        },
        refBand: { labels: drawnLabels, selected: selectedIdx() },
      },
    },
    plugins: [refBandPlugin],
  });
  return chart;
}

export function setEmptyState(canvas, empty) {
  const wrap = canvas.parentElement;
  wrap.querySelector(".empty-msg")?.remove();
  if (!empty) return;
  const div = document.createElement("div");
  div.className = "empty-msg";
  div.textContent = "No data yet — import a PDF, CSV or JSON lab report.";
  wrap.appendChild(div);
}
