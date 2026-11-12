// storage.js — IndexedDB persistence. Local only, no network.
// Stores: "results" (parsed rows), "settings" (UI state).

const DB_NAME = "vervetel";
const DB_VERSION = 1;
const STORE_RESULTS = "results";
const STORE_SETTINGS = "settings";

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_RESULTS)) {
        db.createObjectStore(STORE_RESULTS, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        const out = fn(s);
        t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
        t.onerror = () => reject(t.error);
      })
  );
}

export function rowKey(file, date, test, result) {
  return `${file}|${date}|${test}|${result}`;
}

// rows: [{file, date, test, result, unit, refLow, refHigh, refText, flag}]
export async function saveRows(rows) {
  const keyed = rows.map((r) => ({ ...r, key: rowKey(r.file, r.date, r.test, r.result) }));
  return tx(STORE_RESULTS, "readwrite", (s) => {
    keyed.forEach((r) => s.put(r));
  }).then(() => keyed);
}

export async function deleteFileRows(fileName) {
  return tx(STORE_RESULTS, "readwrite", (s) => {
    const req = s.openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (cur) {
        if (cur.value.file === fileName) cur.delete();
        cur.continue();
      }
    };
  });
}

export async function loadAllRows() {
  return tx(STORE_RESULTS, "readonly", (s) => s.getAll()).then((r) => r || []);
}

export async function getSetting(name, fallback = null) {
  const v = await tx(STORE_SETTINGS, "readonly", (s) => s.get(name));
  return v === undefined ? fallback : v;
}

export async function setSetting(name, value) {
  return tx(STORE_SETTINGS, "readwrite", (s) => s.put(value, name));
}

export async function clearAll() {
  return Promise.all([
    tx(STORE_RESULTS, "readwrite", (s) => s.clear()),
    tx(STORE_SETTINGS, "readwrite", (s) => s.clear()),
  ]);
}

// ---- Export / import (direct browser download / file read, no upload) ----

export async function exportJSON() {
  const rows = await loadAllRows();
  const selection = await getSetting("selection", {});
  const payload = { app: "vervetel-diagram", version: 1, exported: new Date().toISOString(), rows, selection };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vervetel-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseImportJSON(text) {
  const data = JSON.parse(text);
  if (!data || data.app !== "vervetel-diagram" || !Array.isArray(data.rows)) {
    throw new Error("Not a Vervetel export file");
  }
  return data;
}
