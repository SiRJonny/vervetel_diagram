// normalize.js — map lab-specific test names and units to canonical analytes.
// No network. Pure functions.

export function stripAccents(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function low(s) {
  return stripAccents(String(s)).toLowerCase().replace(/\s+/g, " ").trim();
}

// Ordered: more specific patterns first (HDL/LDL before Koleszterin).
// Each entry: [canonicalId, displayLabel, regex list on accent-stripped lowercase]
const ANALYTES = [
  ["hdl", "HDL koleszterin", [/\b(hdl|hdl koleszterin)\b/]],
  ["ldl", "LDL koleszterin", [/\b(ldl|ldl koleszterin)\b/]],
  ["hemoglobin", "Hemoglobin", [/\bhemoglobin\b/, /\bhb\b/]],
  ["leukocytes", "Fehérvérsejt", [
    /\bfehervarsejt(szam|szamzam|szabszam)?\b/, /\bfehervarsejt \(abszolut\)\b/,
    /\bwbc\b/, /\bleukocita\b/]],
  ["erythrocytes", "Vörösvérsejt", [
    /\bvorosversejt(szam)?\b/, /\bvorosvertest\b/, /\brbc\b/]],
  ["hematocrit", "Hematokrit", [/\bhematokrit\b/, /\bhct\b/]],
  ["mcv", "MCV", [/\bmcv\b/]],
  ["mch", "MCH", [/\bmch\b/]],
  ["mchc", "MCHC", [/\bmchc\b/]],
  ["rdw", "RDW-CV", [/\brdw-cv\b/, /\brdw\b/]],
  ["mpv", "MPV", [/\bmpv\b/]],
  ["thrombocytes", "Trombocita", [
    /\btrombocita(szam)?\b/, /\bplt\b/, /\btrombocitaszam\b/]],
  ["neutrophil-abs", "Neutrofil (absz.)", [
    /\bneutrofil granulocita #/, /\bneutrofil \(abszolut\)/]],
  ["lymphocyte-abs", "Limfocita (absz.)", [
    /\blimfocita #/, /\blimfocita \(abszolut\)/]],
  ["monocyte-abs", "Monocita (absz.)", [
    /\bmonocita #/, /\bmonocita \(abszolut\)/]],
  ["eosinophil-abs", "Eozinofil (absz.)", [
    /\beozinofil granulocita #/, /\beozinofil \(abszolut\)/]],
  ["basophil-abs", "Bazofil (absz.)", [
    /\bbazofil granulocita #/, /\bbazofil \(abszolut\)/]],
  ["neutrophil-pct", "Neutrofil %", [
    /\bneutrofil granulocita %/, /^neutrofil %? \d/]],
  ["lymphocyte-pct", "Limfocita %", [/\blimfocita %/]],
  ["monocyte-pct", "Monocita %", [/\bmonocita %/]],
  ["eosinophil-pct", "Eozinofil %", [/\beozinofil granulocita %/]],
  ["basophil-pct", "Bazofil %", [/\bbazofil granulocita %/]],
  ["sodium", "Nátrium", [/\b(natrium|serum na)\b/]],
  ["potassium", "Kálium", [/\b(kalium|serum k)\b/]],
  ["calcium", "Kalcium", [/\b(serum ca|kalcium)\b/]],
  ["magnesium", "Magnézium", [/\b(serum mg|magnezium)\b/]],
  ["asat", "GOT (ASAT)", [/\bgot \(asat\)/, /\basat\b/]],
  ["alat", "GPT (ALAT)", [/\bgpt \(alat\)/, /\balat\b/]],
  ["ggt", "Gamma GT", [/\bgamma gt\b/]],
  ["cholesterol", "Koleszterin", [/\bkoleszterin\b/]],
  ["triglycerides", "Triglicerid", [/\btrigliceride?k?\b/]],
  ["creatinine", "Kreatinin", [/\bkreatinin\b/]],
  ["egfr", "eGFR", [/\begfr\b/]],
  ["urea", "Karbamid", [/\bkarbamid\b/]],
  ["uric-acid", "Húgysav", [/\bhugysav\b/]],
  ["bilirubin-total", "Totál bilirubin", [/\btotal bilirubin\b/]],
  ["bilirubin-direct", "Direkt/konjug. bilirubin", [
    /\bdirekt bilirubin\b/, /\bkonjugalt bilirubin\b/]],
  ["glucose", "Glükóz", [/\bglukoz\b/]],
  ["crp", "CRP", [/\bc reaktiv protein\b/, /\bcrp\b/]],
  ["albumin", "Albumin", [/\balbumin\b/]],
  ["total-protein", "Összfehérje", [/\bosszfeherje\b/]],
  ["iron", "Vas (Fe)", [/\bvas \(fe\)\b/, /\bserum vas\b/]],
  ["tsh", "TSH", [/\btireoidea stimulalo hormon\b/, /\btsh\b/]],
  ["alp", "Alkalikus foszfatáz", [/\balkalikus foszfataz\b/]],
  ["ldh", "LDH", [/\blaktat dehidrogenaz\b/, /\bldh\b/]],
  ["sed-rate", "Vörösvérsejt süllyedés", [/\bvorosversejt sullyedes\b/]],
];

// Unit normalization: different labs, same dimension.
const UNIT_MAP = [
  [/^giga\/l$/i, "G/L"],
  [/^tera\/l$/i, "T/L"],
  [/^umol\/l$/i, "µmol/L"],
  [/^ml\/perc/i, "mL/min"],
  [/^mm\/(ora|óra)$/i, "mm/h"],
  [/^giga$/i, "G/L"],
];

export function normalizeUnit(unit) {
  if (!unit) return "";
  for (const [re, canon] of UNIT_MAP) {
    if (re.test(unit.trim())) return canon;
  }
  return unit.trim();
}

// Exclusion prefixes: a name starting with these is a different specimen,
// never map it to a blood analyte.
const EXCLUDE = [/^vizelet/, /^urin/];

const cache = new Map();

export function matchAnalyte(name) {
  const key = String(name);
  if (cache.has(key)) return cache.get(key);
  let hit = null;
  const l = low(name);
  if (!EXCLUDE.some((re) => re.test(l))) {
    for (const [id, label, regexes] of ANALYTES) {
      if (regexes.some((re) => re.test(l))) {
        hit = { id, label };
        break;
      }
    }
  }
  cache.set(key, hit);
  return hit;
}

export function analyteLabel(id) {
  const a = ANALYTES.find((x) => x[0] === id);
  return a ? a[1] : id;
}

export const CANONICAL_IDS = ANALYTES.map((x) => x[0]);

// Stable color per analyte.
const PALETTE = [
  "#ff5d5d", "#4da3ff", "#5ddba4", "#f5c451", "#b07dff",
  "#ff9d5c", "#5cd6d6", "#e879a8", "#a8e05f", "#8d9dff",
  "#d6b25c", "#ff7d9d", "#6fe08c", "#c47dff", "#7dc4ff",
];

export function analyteColor(id) {
  const idx = CANONICAL_IDS.indexOf(id);
  return PALETTE[(idx < 0 ? 0 : idx) % PALETTE.length];
}
