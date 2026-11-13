# Vervetel Diagram

A local-only web app that parses Hungarian lab report PDFs in the browser and
charts blood test values over time, each analyte normalized to its own
reference interval.

## Privacy

**Hard requirement: user data is never uploaded to any server. Never.**

The server (or GitHub Pages) delivers static code once; after that the app
makes zero network requests. There is no backend, no API, no accounts, no
analytics, no cookies. Reports are parsed in the browser, stored only in
browser-local IndexedDB, and exportable as a JSON file download — a save,
not an upload. The app never receives or processes personal or health data
(GDPR Art. 9). Verify in DevTools Network tab: zero requests while working.

## Running

Serve the folder with any static file server (IndexedDB and pdf.js need a
real origin, not `file://`):

```
python -m http.server 8080
```

`vendor/` bundles Chart.js and pdf.js locally — no CDN, fully offline after
the first load. For hosting: it is a plain static site, so GitHub Pages
(**Settings → Pages → Deploy from a branch → `master` / `(root)`) just works.

## Development

- `npm run test:parse` — Node smoke test: parses `example_data/` PDFs with
  the browser parser and compares row counts to the Python extractor.
- `scripts/extract_pdf_data.py` — the same parsing in Python (reference
  implementation, produces `example_data/extracted.csv`).
