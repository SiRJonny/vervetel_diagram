# Vervetel Diagram

A simple web app for visualizing blood test results as customizable diagrams.

Load a table (CSV / Excel), pick the values you care about, and see them charted.
All data stays on your computer — see [Privacy](#privacy).

## Privacy

**Hard requirement: user data is never uploaded to any server. Never.**

Vervetel Diagram is a purely client-side application. The web server delivers
static code (HTML, JS, CSS) once; after that, nothing is transmitted over the
network. There is no backend, no API, no accounts, no analytics, no cookies.

- Blood test results are loaded from a local file and parsed in the browser.
- Data is stored only on your device: either in a file you chose via the
  File System Access API, or in browser-local storage (IndexedDB / OPFS).
- Charts are rendered locally with client-side libraries.
- You can export your data at any time as a file download — a direct save from
  the browser to your disk, not an upload.

Because the app never receives or processes your data, we never hold any
personal or health data (special category data under GDPR Art. 9). See the
Network tab in your browser's DevTools: after the initial page load, the app
makes zero network requests while you work.

## Tech plan

- **Use:** vanilla JS or a small SPA framework, Chart.js (or similar local
  rendering library), Papa Parse (CSV), SheetJS (Excel), IndexedDB / OPFS /
  File System Access API, self-hosted assets only.
- **Do not use:** any analytics, error trackers, remote fonts, CDN-hosted
  libraries, ads, cookies, accounts, or any code that performs `fetch`/XHR
  to third parties at runtime.

## Running

Serve the folder with any static file server (IndexedDB and pdf.js need a
real origin, not file://):

```
python -m http.server 8080
```

Then open http://localhost:8080. The app works fully offline after the
first load; `vendor/` bundles Chart.js and pdf.js locally — no CDN.

### GitHub Pages

The repo is a plain static site — no build step. Enable
**Settings → Pages → Deploy from a branch → `master` / `(root)`** and open
`https://<user>.github.io/vervetel_diagram/`. All asset paths are relative,
`.nojekyll` disables Jekyll processing. After the page loads the app makes
zero network requests — the Pages server never sees your lab reports.

## Using

- **Import**: drop or pick PDF lab reports (Corden / SYNLAB Hungarian
  layouts), CSV, or a previous JSON export. Everything is parsed and stored
  in your browser (IndexedDB).
- **Chart**: values over time on a shared axis. Each selected analyte is
  normalized to its own reference interval, which is drawn as the two dashed
  common "ref min / ref max" lines. The right edge lists each series'
  actual interval values, colored to match its line.
- **Values panel**: checkboxes on desktop, horizontal chip scroller on
  mobile. Default shows Hemoglobin only; selection persists locally.
- **Export**: downloads all stored data as JSON — a local file save, never
  an upload.

## Project layout

```
index.html          entry page
css/app.css         layout + mobile chip scroller
js/app.js           wiring, state
js/import.js        PDF/CSV/JSON dispatch + row enrichment
js/pdf-parse.js     pdf.js text extraction, JS port of the Python parser
js/normalize.js     test-name alias + unit normalization, colors
js/chart-render.js  normalized multi-series chart + right-edge labels
js/ui.js            analyte selection panel
js/storage.js       IndexedDB, settings, export
vendor/             chart.js + pdf.js (self-hosted)
scripts/            offline dev tools (Python extractor, Node smoke test)
```

## Development

- `npm run test:parse` — Node smoke test: parses `example_data` PDFs with
  the browser parser and compares row counts to the Python extractor.
- `scripts/extract_pdf_data.py` — same parsing in Python (reference
  implementation, produces `example_data/extracted.csv`).
