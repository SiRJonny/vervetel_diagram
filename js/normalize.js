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
  // HbA1c must be matched before plain hemoglobin
  ["hba1c-ifcc", "HbA1c (mmol/mol)", [
    /\bhemoglobin a1c\s*\(ifcc\)/, /\bhemoglobin a1c-ifcc\b/]],
  ["hba1c-pct", "HbA1c %", [/\bhemoglobin a1c\s*%/]],
  ["hemoglobin", "Hemoglobin", [/\bhemoglobin\b/, /\bhb\b/]],
  // sed-rate must be matched before plain erythrocytes ("Vörösvérsejt süllyedés")
  ["sed-rate", "Vörösvérsejt süllyedés", [
    /\bvorosversejt sullyedes\b/, /\bvorosvertest sullyedes\b/,
    /\bsullyedes\b/, /\bwe\b/]],
  ["leukocytes", "Fehérvérsejt", [
    /\bfeherversejt(szam|szamzam|szabszam)?\b/, /\bfeherversejt szam\b/,
    /\bfeherversejt \(abszolut\)\b/, /\bwbc\b/, /\bleukocita\b/]],
  ["erythrocytes", "Vörösvérsejt", [
    /\bvorosversejt(szam)?\b/, /\bvorosvertest\b/, /\bvorosvertest szam\b/,
    /\brbc\b/]],
  ["hematocrit", "Hematokrit", [/\bhematokrit\b/, /\bhct\b/]],
  ["mcv", "MCV", [/\bmcv\b/]],
  ["mch", "MCH", [/\bmch\b/]],
  ["mchc", "MCHC", [/\bmchc\b/]],
  ["rdw", "RDW-CV", [/\brdw-cv\b/, /\brdw\b/]],
  ["mpv", "MPV", [/\bmpv\b/]],
  ["thrombocytes", "Trombocita", [
    /\btrombocita(szam)?\b/, /\btrombocita szam\b/, /\bthrombocyta( szam)?\b/,
    /\bplt\b/]],
  ["neutrophil-abs", "Neutrofil (absz.)", [
    /\bneutrofil granulocita #/, /\bneutrofil \(abszolut\)/,
    /\bneutrophil gran\.? ?#/]],
  ["lymphocyte-abs", "Limfocita (absz.)", [
    /\blimfocita #/, /\blimfocita \(abszolut\)/, /\blymphocyta ?#/]],
  ["monocyte-abs", "Monocita (absz.)", [
    /\bmonocita #/, /\bmonocita \(abszolut\)/, /\bmonocyta ?#/]],
  ["eosinophil-abs", "Eozinofil (absz.)", [
    /\beozinofil granulocita #/, /\beozinofil \(abszolut\)/,
    /\beosinophil gran\.? ?#/]],
  ["basophil-abs", "Bazofil (absz.)", [
    /\bbazofil granulocita #/, /\bbazofil \(abszolut\)/,
    /\bbasophil gran\.? ?#/]],
  ["neutrophil-pct", "Neutrofil %", [
    /\bneutrofil granulocita %/, /\bneutrophil gran\.? ?%/]],
  ["lymphocyte-pct", "Limfocita %", [/\blimfocita %/, /\blymphocyta ?%/]],
  ["monocyte-pct", "Monocita %", [/\bmonocita %/, /\bmonocyta ?%/]],
  ["eosinophil-pct", "Eozinofil %", [
    /\beozinofil granulocita %/, /\beosinophil gran\.? ?%/]],
  ["basophil-pct", "Bazofil %", [/\bbazofil granulocita %/, /\bbasophil gran\.? ?%/]],
  ["sodium", "Nátrium", [/\b(natrium|serum na)\b/]],
  ["potassium", "Kálium", [/\b(kalium|serum k)\b/]],
  ["calcium", "Kalcium", [/\b(serum ca|kalcium|kalzium)\b/]],
  ["magnesium", "Magnézium", [/\b(serum mg|magnezium)\b/]],
  ["asat", "GOT (ASAT)", [/\bgot \(asat\)/, /\basat\b/]],
  ["alat", "GPT (ALAT)", [/\bgpt \(alat\)/, /\balat\b/]],
  ["ggt", "Gamma GT", [/\bgamma gt\b/]],
  ["cholesterol", "Koleszterin", [/\b(ossz koleszterin|koleszterin)\b/]],
  ["triglycerides", "Triglicerid", [/\btrigliceride?k?\b/]],
  ["creatinine", "Kreatinin", [/\bkreatinin\b/]],
  ["egfr", "eGFR", [/\begfr\b/]],
  ["urea", "Karbamid", [/\bkarbamid\b/]],
  ["uric-acid", "Húgysav", [/\bhugysav\b/]],
  ["bilirubin-total", "Totál bilirubin", [/\btotal bilirubin\b/]],
  ["bilirubin-direct", "Direkt/konjug. bilirubin", [
    /\bdirekt bilirubin\b/, /\bkonjugalt bilirubin\b/]],
  ["glucose", "Glükóz", [/\bglukoz\b/, /\bvercukor\b/]],
  ["crp", "CRP", [/\bc reaktiv protein\b/, /\bcrp\b/, /\bhs-crp\b/]],
  ["albumin", "Albumin", [/\balbumin\b/]],
  ["total-protein", "Összfehérje", [/\bosszfeherje\b/]],
  ["iron", "Vas (Fe)", [/\bvas \(fe\)\b/, /\bserum vas\b/, /\bvas\b/]],
  ["tibc", "Transzferrin kapacitás", [/\bteljes vaskoto kapacitas\b/, /\btibc\b/]],
  ["tfsat", "Transzferrin szaturáció", [/\btranszferrin szaturacio\b/]],
  ["transferrin", "Transzferrin", [/\btranszferrin\b/]],
  ["ferritin", "Ferritin", [/\bferritin\b/]],
  ["amylase", "Amiláz", [/\bamilaz\b/]],
  ["ck", "Kreatin kináz", [/\bkreatin kinaz\b/, /\bck\b/]],
  ["psa", "PSA", [/\bprosztata specifikus antig\b/, /\bpsa\b/]],
  // free testosterone / T3/T4 must match before the generic hormone names
  ["testosterone-free", "Tesztoszteron szabad", [
    /\btesztoszteron szabad\b/, /\bfree tesztoszteron\b/]],
  ["testosterone", "Tesztoszteron", [/\btesztoszteron\b/]],
  ["prolactin", "Prolaktin", [/\bprolaktin\b/, /\bprolactin\b/, /\bprl\b/]],
  ["estradiol", "Ösztradiol", [/\bosztradiol\b/, /\bestztradiol\b/]],
  ["progesterone", "Progeszteron", [/\bprogeszteron\b/]],
  ["shbg", "SHBG", [/\bshbg\b/, /\bsex hormon koto feherje\b/]],
  ["dhea-s", "DHEA-S", [/\bdhea\b/]],
  ["d-vitamin", "D-vitamin", [
    /\bd vitamin\b/, /\b25-oh d\b/, /\bd3 vitamin\b/, /\b25oh-?d3?-? ?vitamin\b/]],
  ["parathormon", "Parathormon", [/\bparathormon\b/, /\bpth\b/]],
  ["free-t4", "Szabad T4", [/\bszabad t4\b/, /\bfree t4\b/, /\bft4\b/]],
  ["free-t3", "Szabad T3", [/\bszabad t3\b/, /\bfree t3\b/, /\bft3\b/]],
  ["b12", "B12 vitamin", [/\bb12 vitamin\b/, /\bb12\b/]],
  ["folate", "Fólsav", [/\bfolsav\b/]],
  ["tsh", "TSH", [/\btireoidea stimulalo hormon\b/, /\btsh\b/]],
  ["alp", "Alkalikus foszfatáz", [/\balkalikus foszfataz\b/]],
  ["ldh", "LDH", [/\blaktat dehidrogenaz\b/, /\bldh\b/]],
];

// Unit normalization: different labs, same dimension.
const UNIT_MAP = [
  [/^giga\/l$/i, "G/L"],
  [/^tera\/l$/i, "T/L"],
  [/^umol\/l$/i, "µmol/L"],
  [/^ug\/l$/i, "µg/L"],
  [/^ml\/perc/i, "mL/min"],
  [/^ml\/min(\/1[.,]73\s*m2)?$/i, "mL/min"], // eGFR: mL/min/1.73m2 → mL/min
  [/^mm\/(ora|óra)$/i, "mm/h"],
  [/^giga$/i, "G/L"],
  // TSH international unit in Hungarian lab notation (mNE/L = mIU/L)
  [/^mne\/l$/i, "mIU/L"],
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

// Standard lab panel groupings (concise, 6 groups).
export const GROUPS = [
  ["cbc", "Vérkép", [
    "hemoglobin", "erythrocytes", "hematocrit", "leukocytes", "thrombocytes",
    "mcv", "mch", "mchc", "rdw", "mpv",
    "neutrophil-abs", "lymphocyte-abs", "monocyte-abs",
    "eosinophil-abs", "basophil-abs",
    "neutrophil-pct", "lymphocyte-pct", "monocyte-pct",
    "eosinophil-pct", "basophil-pct",
  ]],
  ["liver", "Máj és enzimek", [
    "asat", "alat", "ggt", "alp", "ldh", "amylase", "ck",
    "bilirubin-total", "bilirubin-direct", "albumin", "total-protein",
  ]],
  ["kidney", "Vese", ["urea", "creatinine", "egfr", "uric-acid"]],
  ["lipid-glucose", "Lipid és cukor", [
    "cholesterol", "hdl", "ldl", "triglycerides",
    "glucose", "hba1c-ifcc", "hba1c-pct",
  ]],
  ["electrolytes-iron", "Elektrolitok és vas", [
    "sodium", "potassium", "calcium", "magnesium",
    "iron", "transferrin", "tibc", "tfsat", "ferritin",
  ]],
  ["inflammation-hormones", "Gyulladás és hormon", [
    "crp", "sed-rate", "tsh", "psa",
    "prolactin", "estradiol", "progesterone",
    "testosterone", "testosterone-free", "shbg", "dhea-s",
    "d-vitamin", "parathormon", "free-t4", "free-t3", "b12", "folate",
  ]],
];

const GROUP_OF = new Map();
for (const [gid, label, ids] of GROUPS) {
  for (const id of ids) GROUP_OF.set(id, gid);
}

export function analyteGroup(id) {
  return GROUP_OF.get(id) || "other";
}

// Expected normalized unit(s) per analyte. Rows with a unit outside this
// list are excluded from charts (prevents mixing e.g. % with g/L).
export const EXPECTED_UNITS = {
  hemoglobin: ["g/L"],
  erythrocytes: ["T/L"],
  hematocrit: ["L/L"],
  mcv: ["fL"],
  mch: ["pg"],
  mchc: ["g/L"],
  rdw: ["%"],
  mpv: ["fL"],
  leukocytes: ["G/L"],
  thrombocytes: ["G/L"],
  "neutrophil-abs": ["G/L"], "lymphocyte-abs": ["G/L"],
  "monocyte-abs": ["G/L"], "eosinophil-abs": ["G/L"], "basophil-abs": ["G/L"],
  "neutrophil-pct": ["%"], "lymphocyte-pct": ["%"], "monocyte-pct": ["%"],
  "eosinophil-pct": ["%"], "basophil-pct": ["%"],
  sodium: ["mmol/L"], potassium: ["mmol/L"], calcium: ["mmol/L"],
  magnesium: ["mmol/L"],
  asat: ["U/L"], alat: ["U/L"], ggt: ["U/L"], alp: ["U/L"], ldh: ["U/L"],
  amylase: ["U/L"], ck: ["U/L"],
  cholesterol: ["mmol/L"], hdl: ["mmol/L"], ldl: ["mmol/L"],
  triglycerides: ["mmol/L"],
  creatinine: ["µmol/L"],
  egfr: ["mL/min"],
  urea: ["mmol/L"],
  "uric-acid": ["µmol/L"],
  "bilirubin-total": ["µmol/L"], "bilirubin-direct": ["µmol/L"],
  glucose: ["mmol/L"],
  crp: ["mg/L"],
  albumin: ["g/L"],
  "total-protein": ["g/L"],
  iron: ["µmol/L"], tibc: ["µmol/L"],
  transferrin: ["g/L"],
  tfsat: ["%"],
  ferritin: ["µg/L"], psa: ["µg/L"],
  tsh: ["mIU/L"],
  prolactin: ["µg/L", "mIU/L"],
  testosterone: ["µg/L", "nmol/L"],
  "testosterone-free": ["ng/L", "pmol/L"],
  estradiol: ["pg/ml", "pmol/L"],
  progesterone: ["ng/ml", "nmol/L"],
  shbg: ["nmol/L"],
  "dhea-s": ["µmol/L"],
  "d-vitamin": ["nmol/L", "ng/ml", "µg/L"],
  parathormon: ["pg/ml", "pmol/L"],
  "free-t4": ["pmol/L", "ng/L"],
  "free-t3": ["pmol/L", "pg/ml"],
  b12: ["pmol/L", "pg/ml"],
  folate: ["nmol/L", "µg/L"],
  "sed-rate": ["mm/h"],
  "hba1c-ifcc": ["mmol/mol"],
  "hba1c-pct": ["%"],
};

// Returns false only when the row has a unit that contradicts the analyte's
// expected unit (rows without unit are kept, cannot judge them).
export function unitAllowed(id, unit) {
  const expected = EXPECTED_UNITS[id];
  if (!expected || !unit) return true;
  return expected.includes(unit);
}

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
