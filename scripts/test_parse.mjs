// Dev-only smoke test: run the in-browser PDF parser under Node against
// example_data and compare row counts with the Python extractor.
// Not shipped, never part of the app bundle.
//
//   node scripts/test_parse.mjs

import { createRequire } from "module";
import { readdirSync, readFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

// Use the npm pdfjs-dist legacy build (Node-compatible CJS) for this test.
// The browser uses the identical vendored UMD in vendor/.
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
globalThis.pdfjsLib = pdfjsLib;
// Node: fake worker resolves workerSrc as a module path.
pdfjsLib.GlobalWorkerOptions.workerSrc =
  require.resolve("pdfjs-dist/legacy/build/pdf.worker.js");

const { parsePdfFile } = await import(
  pathToFileURL(join(root, "js/pdf-parse.js")).href
);

const dir = join(root, "example_data");
const pdfs = readdirSync(dir).filter((f) => f.endsWith(".pdf"));
let failed = false;
for (const f of pdfs) {
  const buf = readFileSync(join(dir, f));
  const rows = await parsePdfFile(new Uint8Array(buf), f);
  const fmt = rows[0]?.file ? "parsed" : "empty";
  console.log(`${f}: ${rows.length} rows (${fmt})`);
  console.log(`  first: ${JSON.stringify(rows[0])}`);
  console.log(`  last:  ${JSON.stringify(rows[rows.length - 1])}`);
  if (!rows.length) failed = true;
}
// Expected: corden 37, synlab 60 (matches scripts/extract_pdf_data.py)
const expected = { "1": 37, "2": 60 };
for (const f of pdfs) {
  const n = /--(\d+)\.pdf$/.exec(f)?.[1];
  if (expected[n]) console.log(`expected ${expected[n]} rows for ${f}`);
}
process.exit(failed ? 1 : 0);
