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
    // portrait canvases get doubled fonts (phone screens are dense)
    const FS = opts.fontScale || 1;
    const yLow = y.getPixelForValue(BAND_LOW);
    const yHigh = y.getPixelForValue(BAND_HIGH);

    // dark outline behind drawn text: labels over lines/other labels stay
    // legible (needed most on portrait where fonts are doubled and space
    // is tight)
    const haloFill = (text, cx, cy) => {
      ctx.save();
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(2, 3 * FS);
      ctx.strokeStyle = "rgba(13,17,23,0.85)";
      ctx.strokeText(text, cx, cy);
      ctx.restore();
      ctx.fillText(text, cx, cy);
    };

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
        ctx.font = `${13 * FS}px system-ui`;
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(223,228,234,0.9)";
        const unit = s.unit ? " " + s.unit : "";
        haloFill(fmt(s.refLow) + unit, cx, yLow + 13 * FS);
        haloFill(fmt(s.refHigh) + unit, cx, yHigh - 5 * FS);
        ctx.textAlign = "right";
        ctx.fillStyle = s.color || "rgba(139,148,163,0.9)";
        ctx.font = `italic ${13 * FS}px system-ui`;
        ctx.fillText(s.label, ca.right - 4, ca.top + 14 * FS);
      }
    }

    // few series (3 or less): label every marker with its value and put the
    // series name next to the last marker — with so few lines there is
    // room, and it spares the user from hovering each point
    if (chart.data.datasets.length <= 3) {
      // portrait doubles these fonts too (labels are tiny otherwise)
      const fs = opts.fontScale || 1;
      ctx.font = `${10 * fs}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // occupied space: every marker blocks its surroundings
      const placed = [];
      for (let i = 0; i < chart.data.datasets.length; i++) {
        const meta = chart.getDatasetMeta(i);
        if (meta) for (const el of meta.data) {
          if (el) placed.push({ x0: el.x - 4.5, y0: el.y - 4.5, x1: el.x + 4.5, y1: el.y + 4.5 });
        }
      }
      // pick the best spot around (x,y) for a text of width w: prefer the
      // sides away from the line's incoming/outgoing segments and away from
      // already placed labels; the least-bad spot wins if everything collides
      const DIRS = [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1]];
      const ptSegDist = (px, py, ax, ay, bx, by) => {
        const dx = bx - ax, dy = by - ay;
        const l2 = dx * dx + dy * dy;
        let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      };
      const place = (text, x, y, segs, maxRing = 1) => {
        const w = ctx.measureText(text).width;
        const hh = 7 * fs; // label rect half-height, scales with the font
        // two rings of candidates: close spots first, farther ones as
        // fallback when everything nearby is taken (dense doubled-font
        // portrait charts need the extra room); maxRing lets names (drawn
        // last, when everything is taken) reach farther than values
        const cands = DIRS.flatMap(([dx, dy], dir) => {
          const rings = [0, 1, ...(maxRing > 1 ? [2] : [])];
          return rings.map((r) => {
            const rank = dir * 3 + r;
            const cx = dx ? x + dx * ((r ? (r > 1 ? 30 : 14) : 6) + w / 2) : x;
            const cy = dx ? y + dy * (r ? (r > 1 ? 30 : 16) : 9)
              : y + dy * ((r ? (r > 1 ? 30 : 16) : 5.5) + 7 * fs);
            const rect = { x0: cx - w / 2 - 1, y0: cy - hh, x1: cx + w / 2 + 1, y1: cy + hh };
            const m = 4 * fs; // bounds margin
            // out of bounds is nearly always worse than any collision: a label
            // that overlaps something is readable, a clipped one is not
            let hits = rect.x0 < ca.left - m || rect.x1 > ca.right + m
              || rect.y0 < ca.top - m || rect.y1 > ca.bottom + m ? 10 : 0;
            let pen = 0;
            for (const s of segs) pen += Math.max(0, 13 * fs - ptSegDist(cx, cy, s[0], s[1], s[2], s[3]));
            for (const rr of placed) {
              if (rect.x0 < rr.x1 && rr.x0 < rect.x1 && rect.y0 < rr.y1 && rr.y0 < rect.y1) hits++;
            }
            return { rank, cx, cy, pen, hits };
          });
        }).sort((a, b) => (a.hits - b.hits) || (a.pen - b.pen) || (a.rank - b.rank));
        const best = cands[0];
        placed.push({
          x0: best.cx - w / 2 - 1, y0: best.cy - hh,
          x1: best.cx + w / 2 + 1, y1: best.cy + hh,
        });
        return best;
      };
      // values first, then names — names get the pick of what is left
      const metas = [];
      for (let i = 0; i < chart.data.datasets.length; i++) {
        const ds = chart.data.datasets[i];
        const meta = chart.getDatasetMeta(i);
        if (!meta || !meta.data.length) continue;
        metas.push([ds, meta]);
        ctx.fillStyle = ds.series.color || "#dfe4ea";
        for (let k = 0; k < meta.data.length; k++) {
          const el = meta.data[k];
          const row = ds.data[k].raw;
          if (!el || row.value === null || row.value === undefined) continue;
          const segs = [];
          if (k > 0) segs.push([meta.data[k - 1].x, meta.data[k - 1].y, el.x, el.y]);
          if (k < meta.data.length - 1) {
            segs.push([el.x, el.y, meta.data[k + 1].x, meta.data[k + 1].y]);
          }
          const text = (row.bound || "") + fmt(row.value);
          const best = place(text, el.x, el.y, segs);
          haloFill(text, best.cx, best.cy);
        }
      }
      for (const [ds, meta] of metas) {
        const last = meta.data[meta.data.length - 1];
        const segs = meta.data.length > 1
          ? [[meta.data[meta.data.length - 2].x, meta.data[meta.data.length - 2].y, last.x, last.y]]
          : [];
        ctx.font = `italic ${10 * fs}px system-ui`;
        ctx.fillStyle = ds.series.color || "#dfe4ea";
        const best = place(ds.series.label, last.x, last.y, segs, 2);
        haloFill(ds.series.label, best.cx, best.cy);
        ctx.font = `${10 * fs}px system-ui`;
      }
      ctx.textBaseline = "alphabetic";
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
  // portrait: double the plugin-drawn fonts (marker labels, annotations) —
  // they were unreadably small on phones. Ticks/tooltip get moderated bumps
  // (a literal 2x there overflows a ~350px-wide phone chart).
  const F = isPortrait ? 2 : 1;

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
            font: { size: isPortrait ? 18 : 12 },
            maxRotation: 0,
            autoSkip: true,
            // portrait: compact YY.MM labels, fewer of them — they would
            // overlap when many datapoints exist
            maxTicksLimit: isPortrait ? 5 : 12,
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
          // portrait: readable tooltip font on dense phone screens
          titleFont: { size: isPortrait ? 16 : 12 },
          bodyFont: { size: isPortrait ? 16 : 12 },
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
        refBand: { labels: drawnLabels, selected: selectedIdx(), fontScale: F },
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
