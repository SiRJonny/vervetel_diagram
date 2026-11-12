// chart-render.js — normalized multi-analyte time chart.
//
// Every visible series is scaled so that its own reference interval
// (refLow..refHigh) maps onto a fixed common band (BAND_LOW..BAND_HIGH)
// on the shared y axis. Two dashed horizontal lines mark that band.
// Each series' actual interval values are shown as colored labels on the
// right edge, stacked top-down.

export const BAND_LOW = 0.2;
export const BAND_HIGH = 0.8;

function fmt(v) {
  if (v === null || v === undefined) return "–";
  const s = String(Math.round(v * 1000) / 1000);
  return s.replace(".", ",");
}

function isoDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  for (const [id, list] of byAnalyte) {
    // reference interval from the most recent row
    const sorted = [...list].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const latest = sorted[sorted.length - 1];
    let lo = latest.refLowN, hi = latest.refHighN;
    // One-sided reference ("max x"): use 0 as min, band bottom as its line.
    if (lo === null && hi !== null) lo = 0;
    if (lo === null || hi === null || hi <= lo) continue; // not plottable

    const y = (v) => BAND_LOW + ((v - lo) / (hi - lo)) * (BAND_HIGH - BAND_LOW);
    const points = sorted
      .map((r) => ({
        x: Date.parse(r.date),
        y: Math.min(1, Math.max(0, y(r.value))),
        raw: r,
      }))
      .filter((p) => !Number.isNaN(p.x))
      .sort((a, b) => a.x - b.x);
    if (!points.length) continue;

    const units = [...new Set(list.map((r) => r.unit).filter(Boolean))];
    const unitStr = units[0] ? " " + units[0] : "";
    const oneSided = latest.refLowN === null;
    series.push({
      id,
      label: latest.analyteLabel,
      unit: units.join(" / "),
      refLow: lo,
      refHigh: hi,
      refLabel: oneSided
        ? `< ${fmt(hi)}${unitStr}`
        : `${fmt(lo)}–${fmt(hi)}${unitStr}`,
      mixedUnits: units.length > 1,
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
    ctx.fillStyle = "rgba(150,160,175,0.8)";
    ctx.font = "10px system-ui";
    ctx.textAlign = "left";
    ctx.fillText("ref max", ca.left + 4, yHigh - 3);
    ctx.fillText("ref min", ca.left + 4, yLow + 11);

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
  const datasets = series.map((s) => ({
    label: s.label,
    data: s.points,
    showLine: true,
    borderColor: s.color,
    backgroundColor: s.color,
    pointRadius: 4,
    pointHoverRadius: 6,
    borderWidth: 2,
    tension: 0.15,
    pointStyle: s.mixedUnits ? "triangle" : "circle",
  }));

  const labels = series.map((s) => ({ color: s.color, text: s.refLabel }));

  // Reserve space on the right so the interval labels never get clipped.
  const maxLabelLen = Math.max(10, ...labels.map((l) => l.text.length));
  const rightPad = Math.min(200, Math.max(96, Math.round(maxLabelLen * 7.2) + 18));

  const chart = new Chart(canvas, {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false, // no grow/slide-in when datasets appear
      layout: { padding: { right: rightPad } },
      parsing: false,
      normalized: true,
      interaction: { mode: "nearest", intersect: true },
      scales: {
        x: {
          type: "linear",
          ticks: {
            color: "#8b94a3",
            callback: (v) => isoDate(v),
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
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
            title: (items) => isoDate(items[0].parsed.x),
            label: (item) => {
              const raw = item.raw.raw;
              const ref = raw.refLowN !== null && raw.refHighN !== null
                ? ` (ref ${fmt(raw.refLowN)}–${fmt(raw.refHighN)})` : "";
              return `${raw.analyteLabel}: ${raw.bound}${fmt(raw.value)} ${raw.unit || ""}${ref}`;
            },
          },
        },
        refBand: { labels },
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
