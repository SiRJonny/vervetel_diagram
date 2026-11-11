# AGENTS.md — Vervetel Diagram

## Hard requirement (non-negotiable)

**No user data may ever leave the user's device over the network.**

This app handles blood test results (GDPR Art. 9 special category data).
The application must remain purely client-side: the server serves static code
only. There is no backend, no API endpoints, no telemetry, no accounts.

## Technical rules

### Allowed

- Client-side parsing: Papa Parse (CSV), SheetJS (Excel).
- Client-side storage: IndexedDB, OPFS, File System Access API (user-selected
  real files on disk).
- Client-side charting: Chart.js / ECharts / D3, bundled locally.
- Direct file downloads (Blob + `URL.createObjectURL`) — this is a save, not
  an upload.
- Optional local encryption at rest via WebCrypto (AES-GCM, PBKDF2-derived
  key from a user passphrase) before writing to local storage.

### Forbidden

- Any network request at runtime: `fetch`, XHR, `WebSocket`,
  `navigator.sendBeacon`, `<img src="http...">`, `<script src="http...">`,
  `<link href="http...">`, CSS `@import url(http...)`.
- Analytics, error trackers (Sentry etc.), A/B tools, ads, cookies,
  service-worker push, accounts/auth against any server.
- CDN-hosted fonts or libraries. All assets self-hosted in the repo.
- Any backend, serverless function, or "optional cloud sync" feature.
- Dependencies that phone home (check before adding).

### Checklist before implementing any new feature

1. Does it introduce a network request after page load? If yes: redesign or
   reject. Verify with DevTools Network tab — zero requests expected.
2. Does it add a dependency? Audit it for embedded telemetry/CDN calls; bundle
   it locally.
3. Does it move data to storage the user doesn't control (new
   localStorage/cookie)? Prefer File System Access or IndexedDB + export.
4. Does it send diagnostics, errors, or "anonymized" metrics anywhere? No.
5. Does it keep the offline promise? The app must work fully offline after
   initial load.

If a feature cannot be built under these rules, stop and discuss — do not
weaken the requirement.
