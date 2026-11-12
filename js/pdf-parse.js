// pdf-parse.js — in-browser PDF lab report parsing (JS port of
// scripts/extract_pdf_data.py). Uses pdf.js (bundled locally, offline).
// Handles the Corden and SYNLAB Hungarian lab layouts.

// Worker path for the browser (vendored UMD). Tests may pre-set
// GlobalWorkerOptions.workerSrc before importing this module.
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";
}

const NUM = String.raw`\d+(?:[.,]\d+)?`;
const CAPS = "A-ZÁÉÍÓÖŐÚÜŰ";
const NUM_RE = new RegExp(`^${NUM}$`);
const NUM_PREFIXED_RE = new RegExp(`^[<>]?${NUM}$`);
const REF_RANGE_RE = new RegExp(`^(${NUM})\\s*-\\s*(${NUM})$`);
const REF_BOUND_RE = new RegExp(`([<>]=?)\\s*(${NUM})`);

const WORD_RESULTS = new Set(["negatív", "normális", "pozitív"]);
const FLAGS = new Set(["h", "l", "+"]);
const BOUND_OPS = new Set(["<", ">", "<=", ">="]);

const SECTION_PHRASES = new Set([
  "vizelet üledék", "vizelet kémia", "vérkép automatával",
]);
const SECTION_TRAILING_RE = new RegExp(
  `\\s+[${CAPS}][${CAPS}0-9]+(?:\\s+[${CAPS}][${CAPS}0-9]+)*$`);

const FOOTER_KEYWORDS = [
  "átváltás", "változás", "labor", "leletnyomtatás", "oldal",
  "synlab", "azonosító", "validálta", "validálók", "akkredit", "orvos", "információ",
  "taj", "mintavétel", "rögzítés", "lakcím", "beküld", "szakmai",
  "ügyfélszolgálat", "www.", "https", "automata mikroszkópos",
  "számolható", "mikroliter", "ellenőrizve", "amennyiben",
  "módszer", "hiteles", "kezelőorvos", "vizsgálat eredmény",
  "budapest", "ajka", "székesfehérvár", "dunaújváros", "kiskunhalas",
  "weiss manfréd", "korányi", "seregélyesi", "monszpart", "vizelet általános",
  "megj.", "eeszt", "renderel", "létrehozás", "kiadás", "generált",
];

// ---------------------------------------------------------------- helpers --

function isFooter(line) {
  const low = line.toLowerCase();
  if (FOOTER_KEYWORDS.some((k) => low.includes(k))) return true;
  return line.startsWith("•") || line.startsWith("\uFFFD");
}

function cleanName(name, stripCaps) {
  if (stripCaps) name = name.replace(SECTION_TRAILING_RE, "").trim();
  const low = name.toLowerCase();
  for (const phrase of SECTION_PHRASES) {
    if (low.endsWith(phrase)) name = name.slice(0, -phrase.length).trim();
  }
  return name.replace(/^[\s,;-]+|[\s,;-]+$/g, "");
}

function isSectionLine(line) {
  const low = line.trim().toLowerCase();
  if (SECTION_PHRASES.has(low)) return true;
  const tokens = line.split(/\s+/);
  return tokens.length <= 3 && tokens.length > 0 && tokens.every(
    (t) => t === t.toUpperCase() && new RegExp(`[${CAPS}]`).test(t));
}

function looksLikeNameFragment(line, tokens) {
  return tokens.length <= 6 && !line.endsWith(".") && !line.endsWith(":")
    && !SECTION_TRAILING_RE.test(tokens.join(" "))
    && !SECTION_PHRASES.has(line.toLowerCase());
}

function hasUnbalancedClose(text) {
  let opens = 0, closes = 0;
  for (const ch of text) {
    if (ch === "(") opens++;
    else if (ch === ")") { closes++; if (closes > opens) return true; }
  }
  return false;
}

function isUnitLike(token) {
  // Unicode-aware: units may contain Hungarian letters (mm/óra)
  return /^[A-Za-zµ°%][\p{L}\p{M}\d%/².]*$/u.test(token)
    && /[A-Za-zµ°%]/.test(token);
}

function cleanRefText(tokens) {
  while (tokens.length && (FLAGS.has(tokens[0]) || tokens[0] === "-")) tokens.shift();
  return tokens.join(" ").trim();
}

function toNum(s) {
  return s.replace(",", ".");
}

function makeRow(date, name, result, unit, refText, flag, stripCaps) {
  const m = REF_RANGE_RE.exec(refText.trim());
  let refLow = "", refHigh = "";
  if (m) {
    refLow = toNum(m[1]);
    refHigh = toNum(m[2]);
    refText = "";
  }
  return {
    date, test: cleanName(name, stripCaps), result, unit,
    refLow, refHigh, refText, flag,
  };
}

function joinName(pending, name) {
  // A lone word-result fragment ("Nem") belongs after the name, not before.
  const p = (pending || "").trim();
  const n = (name || "").trim();
  if (p && p.toLowerCase() === "nem") return n; // "Nem számolható" — noise
  if (p && WORD_RESULTS.has(p.toLowerCase()) && n) return n + " " + p;
  return (p + " " + n).trim();
}

// ---------------------------------------------------------------- Corden ----

const CORDEN_DATE_RE = /Mintavétel ideje[^:]*:\s*(\d{4}-\d{2}-\d{2})/;
const CORDEN_ROW_RE = /^(?:\d{4,6}\s+)?(.+?)\s*:\s*(.+)$/;
const CORDEN_CONT_RE = new RegExp(`^${NUM}\\s*(mL/perc|felett|mmol/L)`);
const CORDEN_CODE_RE = /^\d{4,6}[A-Z]?\s+/;

function parseCorden(lines) {
  let date = "";
  const rows = [];
  for (let raw of lines) {
    const line = raw.trim();
    if (!line || /^[-\s]+$/.test(line)) continue;
    const dm = CORDEN_DATE_RE.exec(line);
    if (dm) { date = dm[1]; continue; }
    if (isFooter(line)) continue;
    const rm = CORDEN_ROW_RE.exec(line);
    if (!rm) {
      if (rows.length && CORDEN_CONT_RE.test(line)) {
        rows[rows.length - 1].refText =
          (rows[rows.length - 1].refText + " " + line).trim();
      }
      continue;
    }
    const name = rm[1].trim().replace(CORDEN_CODE_RE, "");
    const tokens = rm[2].trim().split(/\s+/);
    const idx = tokens.findIndex((t) => NUM_RE.test(t));
    if (idx === -1) continue;
    const result = toNum(tokens[idx]);
    const after = tokens.slice(idx + 1);
    let flag = "";
    while (after.length && FLAGS.has(after[0])) flag = after.shift();
    const unit = after.length ? after.shift() : "";
    let refText = cleanRefText(after).replace(/\s*Valid$/, "");
    const bm = REF_BOUND_RE.exec(refText);
    if (bm) refText = (bm[1] + " " + toNum(bm[2])).trim();
    rows.push(makeRow(date, name, result, unit, refText, flag, false));
  }
  return rows;
}

// ---------------------------------------------------------------- SYNLAB ----

const SYNLAB_DATE_RE = /Mintavétel:\s*([\d.]+)/;
// pdf.js splits the date onto its own line ("2026.01.26 2026.01.26 00:00");
// the first date is the sample collection time.
const SYNLAB_DATE_LINE_RE = /^(\d{4}\.\d{2}\.\d{2})\s+\d{4}\.\d{2}\.\d{2}/;

function parseSynlab(lines) {
  let date = "";
  const rows = [];
  let pendingName = "";
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const dm = SYNLAB_DATE_RE.exec(line);
    if (dm) { date = dm[1].replace(/\./g, "-"); continue; }
    const dl = SYNLAB_DATE_LINE_RE.exec(line);
    if (dl) { date = dl[1].replace(/\./g, "-"); continue; }
    if (isFooter(line)) continue;
    const tokens = line.split(/\s+/);

    // locate result: "<" / ">" operator + number, or bare number token
    let idx = null, opIndex = null, prefix = "";
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (BOUND_OPS.has(t) && i + 1 < tokens.length && NUM_RE.test(tokens[i + 1])) {
        idx = i + 1; opIndex = i; prefix = t[0];
        break;
      }
      if (NUM_PREFIXED_RE.test(t)) { idx = i; break; }
    }

    if (idx === null) {
      if (isSectionLine(line)) { pendingName = ""; continue; }
      const wordIdx = tokens.findIndex(
        (t, i) => i > 0 && WORD_RESULTS.has(t.toLowerCase()));
      if (wordIdx === -1) {
        if (looksLikeNameFragment(line, tokens)) {
          if (hasUnbalancedClose(line)) {
            if (rows.length) {
              rows[rows.length - 1].test =
                cleanName(rows[rows.length - 1].test + " " + line, true);
            }
          } else {
            pendingName = (pendingName + " " + line).trim();
          }
        }
        continue;
      }
      // non-numeric result row: name <result-word> <ref> [unit]
      const name = tokens.slice(0, wordIdx).join(" ").trim();
      const rest = tokens.slice(wordIdx + 1);
      const unit = rest.length && isUnitLike(rest[rest.length - 1]) ? rest.pop() : "";
      rows.push(makeRow(date, joinName(pendingName, name), tokens[wordIdx],
        unit, cleanRefText(rest), "", true));
      pendingName = "";
      continue;
    }

    const resultToken = tokens[idx];
    const after = tokens.slice(idx + 1);
    const nameTokens = opIndex !== null ? tokens.slice(0, opIndex)
      : tokens.slice(0, idx);

    // "<"/">" prefix: belongs to the result (<7.0 mg/L, no ref) or to the
    // reference column (0.4, ref < 5.0). If a ref-like token remains
    // besides the unit, it is a reference; otherwise it is the result.
    let attached = "";
    if (opIndex !== null || resultToken.startsWith("<") || resultToken.startsWith(">")) {
      const rest = after.length && isUnitLike(after[after.length - 1])
        ? after.slice(0, -1) : after;
      if (!rest.some((t) => NUM_RE.test(t) || REF_BOUND_RE.test(t))) {
        attached = prefix || resultToken[0];
      }
    }

    const result = toNum(resultToken.replace(/[<>=]/g, ""));
    let flag = "";
    while (after.length && (FLAGS.has(after[0]) || after[0] === "-")) {
      if (FLAGS.has(after[0])) flag = after.shift();
      else after.shift();
    }
    let unit = "", refTokens = after;
    if (after.length && isUnitLike(after[after.length - 1])) {
      unit = after.pop();
      refTokens = after;
    }
    let refText = cleanRefText(refTokens);
    if (attached) {
      rows.push(makeRow(date, joinName(pendingName, nameTokens.join(" ")),
        attached + result, unit, "", flag, true));
    } else {
      if (prefix) refText = (prefix + " " + refText).trim();
      else if (refText && !/\d\s*-\s*\d/.test(refText)) {
        const bm = REF_BOUND_RE.exec(refText);
        if (bm) refText = (bm[1] + " " + toNum(bm[2])).trim();
      }
      rows.push(makeRow(date, joinName(pendingName, nameTokens.join(" ")),
        result, unit, refText, flag, true));
    }
    pendingName = "";
  }
  return rows;
}

// ---------------------------------------------------------------- EESZT ----
// EESZT/Corden LOINC table rows, e.g.
//   3 718-7 Hemoglobin 151.00 g/L 136.00 - 177.00 g/L VALIDÁLT
//   24 Transzferrin 2.0 g/L 2.0 - 3.6 g/L VALIDÁLT
//   27 Glüköz reggeli előtt 4.92 mmol/L VALIDÁLT          (no reference)

const EESZT_DATE_RE =
  /(?:Ellátás|Mintavétel) időpontja:\s*(\d{4}\.\d{2}\.\d{2})/;
const LOINC_RE = /^\d{2,7}-\d$/;
const ORDINAL_RE = /^\d{1,3}$/;
const EESZT_SECTIONS = new Set([
  "teljes vérkép", "általános vizelet vizsgálat", "vizelet ülédék",
  "általános laboratóriumi lelet",
]);
const EESZT_FLAGS = new Set(["alacsony", "magas"]);

function parseEeszt(lines) {
  let date = "";
  const rows = [];
  let pendingName = "";
  let tableStarted = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // only collect rows below the "LOINC Vizsgálat Eredmény ..." header
    if (!tableStarted) {
      if (/loinc/i.test(line) && /eredmény/i.test(line)) tableStarted = true;
      const dm = EESZT_DATE_RE.exec(line);
      if (dm) date = dm[1].replace(/\./g, "-");
      continue;
    }
    const dm = EESZT_DATE_RE.exec(line);
    if (dm) { date = dm[1].replace(/\./g, "-"); continue; }
    if (isFooter(line)) continue;
    let tokens = line.split(/\s+/);

    // section headers between row blocks
    if (tokens.length <= 5
        && EESZT_SECTIONS.has(tokens.join(" ").toLowerCase())) {
      pendingName = "";
      continue;
    }

    // strip leading ordinal number and optional LOINC code
    if (tokens.length && ORDINAL_RE.test(tokens[0])) tokens = tokens.slice(1);
    if (tokens.length && LOINC_RE.test(tokens[0])) tokens = tokens.slice(1);
    if (!tokens.length) continue;

    // "eGFR 90 felett VALIDÁLT": reference only, no result — drop the row
    if (tokens.length >= 2 && tokens[tokens.length - 1] === "felett"
        && NUM_RE.test(tokens[tokens.length - 2])) {
      continue;
    }

    // locate result: first bare number token
    const idx = tokens.findIndex((t) => NUM_RE.test(t));
    if (idx === -1) {
      // wrapped name fragment (skip balanced-paren noise like "kód (Validáló)")
      if (tokens.length <= 6
          && (!line.includes("(") || hasUnbalancedClose(line))) {
        if (hasUnbalancedClose(line) && rows.length) {
          rows[rows.length - 1].test += " " + line;
        } else {
          pendingName = (pendingName + " " + line).trim();
        }
      }
      continue;
    }

    const name = joinName(pendingName, tokens.slice(0, idx).join(" ").trim());
    pendingName = "";
    const result = toNum(tokens[idx]);
    const after = tokens.slice(idx + 1);
    // strip trailing status word
    while (after.length && /^(valid|validált)$/i.test(after[after.length - 1])) {
      after.pop();
    }
    let flag = "";
    if (after.length && EESZT_FLAGS.has(after[after.length - 1])) {
      flag = after.pop();
    }
    let unit = "";
    if (after.length && isUnitLike(after[0])) {
      unit = after.shift();
    }
    // reference may repeat the unit ("136.00 - 177.00 g/L")
    if (after.length && isUnitLike(after[after.length - 1])) after.pop();
    const refText = cleanRefText(after);
    rows.push(makeRow(date, name, result, unit, refText, flag, false));
  }
  return rows;
}

// ------------------------------------------------------------- text layer --

// Rebuild visual text lines from pdf.js text items (grouped by y, sorted
// by x; space inserted when the horizontal gap exceeds one space width).
function extractLines(textContent) {
  const items = textContent.items;
  const lines = [];
  for (const it of items) {
    const y = Math.round(it.transform[5] * 2) / 2;
    let line = lines.find((l) => Math.abs(l.y - y) <= 3);
    if (!line) {
      line = { y, parts: [] };
      lines.push(line);
    }
    line.parts.push({ x: it.transform[4], w: it.width || 0, s: it.str });
  }
  lines.sort((a, b) => b.y - a.y);
  return lines.map((l) => {
    l.parts.sort((a, b) => a.x - b.x);
    let out = "";
    let prevEnd = null;
    for (const p of l.parts) {
      if (prevEnd !== null && p.x - prevEnd > 1.2 && !out.endsWith(" ")) out += " ";
      out += p.s;
      prevEnd = p.x + p.w;
    }
    return out.replace(/\s+/g, " ").trim();
  }).filter(Boolean);
}

export async function parsePdfFile(arrayBuffer, fileName) {
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allLines = [];
  let firstPage = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    if (i === 1) firstPage = extractLines(tc).join("\n");
    allLines.push(...extractLines(tc));
  }
  const fmt = firstPage.includes("Synlab") ? "synlab"
    : firstPage.includes("LOINC") ? "eeszt" : "corden";
  const parser = fmt === "synlab" ? parseSynlab
    : fmt === "eeszt" ? parseEeszt : parseCorden;
  const rows = parser(allLines)
    .filter((r) => r.test && r.result !== undefined);
  rows.forEach((r) => { r.file = fileName; });
  return rows;
}
