// import.js — load PDF / CSV / JSON files. All parsing is local.

import { parsePdfFile } from "./pdf-parse.js";
import { matchAnalyte, normalizeUnit, analyteLabel, unitAllowed, convertAnalyteUnit } from "./normalize.js";
import { saveRows, deleteFileRows, parseImportJSON, rowKey } from "./storage.js";

// -- CSV -----------------------------------------------------------------

export function parseCsv(text) {
  const rows = [];
  let i = 0, field = "", row = [], inQuotes = false;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (field !== "" || row.length) { row.push(field); rows.push(row); field = ""; row = []; }
      if (ch === "\r" && text[i + 1] === "\n") i++;
    } else field += ch;
    i++;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function csvToRows(text, fileName) {
  const table = parseCsv(text);
  if (!table.length) return [];
  const header = table[0].map((h) => h.trim().toLowerCase());
  const idx = (names) => header.findIndex((h) => names.includes(h));
  const c = {
    file: idx(["file"]), date: idx(["date"]), test: idx(["test", "name"]),
    result: idx(["result", "value"]), unit: idx(["unit"]),
    refLow: idx(["ref_low", "ref min"]), refHigh: idx(["ref_high", "ref max"]),
    refText: idx(["ref_text"]), flag: idx(["flag"]),
  };
  const out = [];
  for (let r = 1; r < table.length; r++) {
    const g = (i) => (c[i] >= 0 ? (table[r][c[i]] || "").trim() : "");
    if (!g(c.test) && !g(c.result)) continue;
    out.push({
      file: g(c.file) || fileName, date: g(c.date), test: g(c.test),
      result: g(c.result), unit: g(c.unit), refLow: g(c.refLow),
      refHigh: g(c.refHigh), refText: g(c.refText), flag: g(c.flag),
    });
  }
  return out;
}

// -- enrichment ----------------------------------------------------------

function numericResult(result) {
  const m = /^([<>]=?)?(\d+(?:[.,]\d+)?)$/.exec(String(result).trim());
  if (!m) return null;
  return { value: parseFloat(m[2].replace(",", ".")), bound: m[1] || "" };
}

export function enrich(rows) {
  const excluded = [];
  const out = rows
    .map((r) => {
      const analyte = matchAnalyte(r.test);
      const num = numericResult(r.result);
      let { refLow, refHigh } = r;
      if ((!refLow || !refHigh) && r.refText) {
        const bm = /^([<>]=?)\s*(\d+(?:[.,]\d+)?)$/.exec(r.refText.trim());
        if (bm) {
          if (bm[1].includes("<")) refHigh = bm[2].replace(",", ".");
          else refLow = bm[2].replace(",", ".");
        }
      }
      const unit = normalizeUnit(r.unit);
      let analyteId = analyte ? analyte.id : null;
      let analyteLabelOut = analyte ? analyte.label : r.test;
      let excludedReason = "";
      // urine and blood are different specimens: a urine row must never
      // become a blood value, even when the test name matches (Fehérvérsejt)
      if (analyteId && r.urine) {
        excludedReason = "urine specimen — kept out of blood values";
        analyteId = null;
      }
      // convert dual-unit analytes (pmol/L → pg/mL etc.) onto the target unit
      let conv = null;
      if (analyteId) {
        conv = convertAnalyteUnit(analyteId, unit);
        if (conv === null) {
          excludedReason = `unit "${unit}" not expected for ${analyte.label}`;
          analyteId = null;
        } else if (num && !unitAllowed(analyteId, conv.unit)) {
          excludedReason = `unit "${conv.unit}" not expected for ${analyte.label}`;
          analyteId = null;
        }
      }
      if (excludedReason) excluded.push({ test: r.test, reason: excludedReason });
      const fv = conv ? conv.f : 1;
      return {
        ...r,
        unit: conv ? conv.unit : unit,
        analyteId,
        analyteLabel: analyteLabelOut,
        excluded: excludedReason,
        value: num ? num.value * fv : null,
        bound: num ? num.bound : "",
        refLowN: refLow !== ""
          ? parseFloat(String(refLow).replace(",", ".")) * fv : null,
        refHighN: refHigh !== ""
          ? parseFloat(String(refHigh).replace(",", ".")) * fv : null,
      };
    })
    .filter((r) => r.analyteId && r.value !== null);
  return { rows: out, excluded };
}

// -- file dispatch -------------------------------------------------------

async function readAsText(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(fr.error);
    fr.readAsText(file);
  });
}

async function readAsArrayBuffer(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(fr.error);
    fr.readAsArrayBuffer(file);
  });
}

// Import one or more files; returns {added, replaced, errors, skipped} and persists.
// "skipped" holds unusable rows (wrong unit etc.) — not errors, the rest loads.
export async function importFiles(files) {
  let added = 0, replaced = 0;
  const errors = [];
  const skipped = [];
  for (const file of files) {
    try {
      let raw = [];
      const name = file.name;
      if (/\.pdf$/i.test(name)) {
        raw = await parsePdfFile(await readAsArrayBuffer(file), name);
      } else if (/\.csv$/i.test(name)) {
        raw = csvToRows(await readAsText(file), name);
      } else if (/\.json$/i.test(name)) {
        const data = parseImportJSON(await readAsText(file));
        raw = data.rows;
      } else {
        errors.push(`${name}: unsupported file type`);
        continue;
      }
      const { rows, excluded } = enrich(raw);
      if (!rows.length) {
        errors.push(`${name}: no blood test rows recognized`);
        continue;
      }
      for (const e of excluded) {
        skipped.push({ file: name, test: e.test, reason: e.reason });
      }
      const existed = await hasFile(name);
      if (existed) {
        await deleteFileRows(name);
        replaced++;
      } else added++;
      await saveRows(rows);
    } catch (e) {
      errors.push(`${file.name}: ${e.message || e}`);
    }
  }
  return { added, replaced, errors, skipped };
}

async function hasFile(name) {
  const { loadAllRows } = await import("./storage.js");
  return (await loadAllRows()).some((r) => r.file === name);
}

export { rowKey };
