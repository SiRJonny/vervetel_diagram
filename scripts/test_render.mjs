// Dev-only: stubbed DOM end-to-end check that ui.js + chart-render.js load
// and render without runtime errors. Run: node scripts/test_render.mjs
globalThis.pdfjsLib = { GlobalWorkerOptions: {} };
const mkEl = () => ({
  children: [], style: {}, dataset: {}, hidden: false, className: "",
  appendChild(c) { this.children.push(c); },
  append(...c) { this.children.push(...c); },
  addEventListener() {},
  set innerHTML(v) { this.children = []; },
  get innerHTML() { return ""; },
  textContent: "", title: "", type: "", setAttribute() {},
  querySelector() { return null; },
  parentElement: { querySelector() { return null; }, appendChild() {} },
  getBoundingClientRect() { return { top: 0, bottom: 0, left: 0, width: 0 }; },
});
globalThis.window = globalThis;
globalThis.window.addEventListener = () => {};
globalThis.window.matchMedia = () => ({ matches: false });
globalThis.document = {
  createElement: mkEl,
  getElementById: () => mkEl(),
  body: mkEl(),
  addEventListener() {},
};
globalThis.Chart = function () { return { destroy() {} }; };

const [{ renderAnalyteList }, cr] = await Promise.all([
  import("../js/ui.js"),
  import("../js/chart-render.js"),
]);

const analytes = new Map([
  ["hemoglobin", { label: "Hemoglobin", count: 3, plottable: true }],
  ["sed-rate", { label: "Süllyedés", count: 2, plottable: false }],
]);
renderAnalyteList(mkEl(), analytes, new Set(["hemoglobin"]), () => {});

const rows = [{
  analyteId: "hemoglobin", analyteLabel: "Hemoglobin", value: 151, bound: "",
  refLowN: 136, refHighN: 177, unit: "g/L", date: "2025-05-06",
}];
const s = cr.buildSeries(rows, new Set(["hemoglobin"]));
cr.renderChart(mkEl(), s);
cr.setEmptyState(mkEl(), false);
console.log("ALL OK — list + chart render without error");
