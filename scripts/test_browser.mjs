// temp: bisect the real-browser layout shift on selection
import puppeteer from "puppeteer-core";
import http from "http";
import { readFile } from "fs/promises";
import { extname, join } from "path";

const MIME = { ".html": "text/html", ".js": "text/javascript" };
const server = http.createServer(async (req, res) => {
  const p = req.url === "/" ? "/test-diagram.html" : req.url.split("?")[0];
  try {
    const data = await readFile(join(process.cwd(), p));
    res.writeHead(200, { "content-type": MIME[extname(p)] || "text/html" });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8932, r));

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--no-sandbox", "--force-device-scale-factor=1"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });
await page.goto("http://127.0.0.1:8932/", { waitUntil: "networkidle0" });
await page.waitForFunction(() => window.__chart);

const diag = () => page.evaluate(() => {
  const c = window.__chart;
  return JSON.stringify({
    area: c.chartArea,
    sx: { h: c.scales.x.height, w: c.scales.x.width, l: c.scales.x.left, t: c.scales.x.top },
    sy: { w: c.scales.y.width, h: c.scales.y.height, l: c.scales.y.left, t: c.scales.y.top },
    mp: c._minPadding,
    px0: c.getDatasetMeta(0).data[0].x,
  });
});
const eq = (a, b) => a === b;

// 1: hover only (no click)
const d0 = await diag();
const pt = await page.evaluate(() => {
  const p = window.__chart.getDatasetMeta(0).data[3];
  const r = window.__chart.canvas.getBoundingClientRect();
  return { x: r.left + p.x, y: r.top + p.y };
});
await page.mouse.move(pt.x, pt.y);
await new Promise((r) => setTimeout(r, 200));
const dHover = await diag();

// 2: click = select
await page.mouse.click(pt.x, pt.y);
await new Promise((r) => setTimeout(r, 250));
const dSel = await diag();

// 3: click = deselect
await page.mouse.click(pt.x, pt.y);
await new Promise((r) => setTimeout(r, 250));
const dDes = await diag();

// 4: pure update with no state change at all
await page.evaluate(() => window.__chart.update("none"));
await new Promise((r) => setTimeout(r, 250));
const dUpd = await diag();

for (const [name, a, b] of [["hover", d0, dHover], ["select", dHover, dSel], ["deselect", dSel, dDes], ["plain update", dDes, dUpd]]) {
  console.log(`${name}: ${eq(a, b) ? "IDENTICAL" : "SHIFTED"}`);
  if (!eq(a, b)) { console.log("  pre :", a); console.log("  post:", b); }
}
console.log("final:", dUpd);
await browser.close();
server.close();
