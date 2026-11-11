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

Open `index.html` or serve the folder with any static file server.
No build step, no server-side component.
