# -*- coding: utf-8 -*-
"""Extract blood test rows from lab report PDFs into one CSV.

Columns: file, date, test, result, unit, ref_low, ref_high, ref_text, flag.
Handles two Hungarian lab layouts: Corden International and SYNLAB Hungary.

Usage:
  python scripts/extract_pdf_data.py [input_dir] [output_csv]

Runs fully offline; no network access.
"""

import csv
import re
import sys
from pathlib import Path

import pdfplumber

NUM = r"\d+(?:[.,]\d+)?"
WORD_RESULTS = {"negatív", "normális", "pozitív"}
FLAGS = {"h", "l", "+"}
BOUND_OPS = {"<", ">", "<=", ">="}
CAPS = r"A-ZÁÉÍÓÖŐÚÜŰ"

# Section headers glued to test names in the SYNLAB layout.
SECTION_TRAILING_RE = re.compile(
    rf"\s+[{CAPS}][{CAPS}0-9]+(?:\s+[{CAPS}][{CAPS}0-9]+)*$")
SECTION_PHRASES = ("vizelet üledék", "vizelet kémia", "vérkép automatával")

FOOTER_KEYWORDS = [
    "átváltás", "változás", "labor", "leletnyomtatás", "oldal:",
    "synlab", "azonosító", "validál", "akkredit", "orvos", "információ",
    "taj", "mintavétel", "rögzítés", "lakcím", "beküld", "szakmai",
    "ügyfélszolgálat", "www.", "https", "automata mikroszkópos",
    "számolható", "mikroliter", "ellenőrizve", "amennyiben",
    "módszer", "hiteles", "kezelőorvos", "vizsgálat eredmény",
    "budapest", "ajka", "székesfehérvár", "dunaújváros", "kiskunhalas",
    "weiss manfréd", "korányi", "seregélyesi", "monszpart", "vizelet általános",
]

REF_RANGE = re.compile(rf"({NUM})\s*-\s*({NUM})")
REF_BOUND = re.compile(rf"([<>]=?)\s*({NUM})")
UNIT_RE = re.compile(r"[A-Za-zµ°%][\w%/².]*")


def is_footer(line: str) -> bool:
    low = line.lower()
    return (any(k in low for k in FOOTER_KEYWORDS)
            or line.startswith("•") or line.startswith("�"))


def clean_name(name: str, strip_caps: bool = False) -> str:
    """Drop section headers glued to the end of a test name.

    strip_caps is only used for the SYNLAB layout; Corden test names may
    legitimately end in all-caps (MCV, MCH, eGFR...).
    """
    if strip_caps:
        name = SECTION_TRAILING_RE.sub("", name).strip()
    low = name.lower()
    for phrase in SECTION_PHRASES:
        if low.endswith(phrase):
            name = name[: -len(phrase)].strip()
    return name.strip(" -,;")


def is_section_line(line: str) -> bool:
    """A standalone section header (e.g. HEMATOLOGIA, Vizelet üledék)."""
    low = line.strip().lower()
    if low in SECTION_PHRASES:
        return True
    tokens = line.split()
    return len(tokens) <= 3 and tokens and all(
        t.upper() == t and re.search(rf"[{CAPS}]", t) for t in tokens)


def split_ref(ref_text: str):
    """Try to read low - high bounds out of a reference string."""
    m = REF_RANGE.fullmatch(ref_text.strip())
    if m:
        return m.group(1).replace(",", "."), m.group(2).replace(",", "."), ""
    return "", "", ref_text


def clean_ref_text(tokens) -> str:
    """Drop stray flag/separator tokens from the start of reference text."""
    while tokens and (tokens[0] in FLAGS or tokens[0] == "-"):
        tokens.pop(0)
    return " ".join(tokens).strip()


def make_row(date, name, result, unit, ref_text, flag, strip_caps=False):
    ref_low, ref_high, ref_text = split_ref(ref_text)
    return dict(date=date, test=clean_name(name, strip_caps), result=result,
                unit=unit, ref_low=ref_low, ref_high=ref_high,
                ref_text=ref_text, flag=flag)


# ---------------------------------------------------------------- Corden ----
# Rows look like:  21501 Szérum K : 3,90 mmol/L 3,50 - 5,50 Valid
#              or  Bazofil (abszolút) : 0,04 G/L < 0,10

CORDEN_DATE = re.compile(r"Mintavétel ideje[^:]*:\s*(\d{4}-\d{2}-\d{2})")
CORDEN_ROW = re.compile(r"^(?:\d{4,6}\s+)?(.+?)\s*:\s*(.+)$")
CORDEN_CONT = re.compile(rf"^{NUM}\s*(mL/perc|felett|mmol/L)")
CORDEN_CODE = re.compile(r"^\d{4,6}[A-Z]?\s+")


def parse_corden(lines):
    date = ""
    rows = []
    for line in lines:
        line = line.strip()
        if not line or set(line) <= {"-", " "}:
            continue
        m = CORDEN_DATE.search(line)
        if m:
            date = m.group(1)
            continue
        if is_footer(line):
            continue
        m = CORDEN_ROW.match(line)
        if not m:
            # continuation of previous reference text (e.g. eGFR explanation)
            if rows and CORDEN_CONT.match(line):
                rows[-1]["ref_text"] = (rows[-1]["ref_text"] + " " + line).strip()
            continue

        name = CORDEN_CODE.sub("", m.group(1).strip())
        tokens = m.group(2).strip().split()
        idx = next((i for i, t in enumerate(tokens)
                    if re.fullmatch(rf"{NUM}", t)), None)
        if idx is None:
            continue
        result = tokens[idx].replace(",", ".")
        after = tokens[idx + 1:]
        flag = ""
        while after and after[0] in FLAGS:
            flag = after.pop(0)
        unit = after.pop(0) if after else ""
        ref_text = clean_ref_text(after)
        ref_text = re.sub(r"\s*Valid$", "", ref_text)
        bm = REF_BOUND.match(ref_text)
        if bm:
            ref_text = (bm.group(1) + " " + bm.group(2).replace(",", ".")).strip()
        rows.append(make_row(date, name, result, unit, ref_text, flag))
    return rows


# ---------------------------------------------------------------- SYNLAB ----
# Rows look like:  Hemoglobin (A) 158 140 - 175 g/L
#              or  C reaktív protein (CRP) (A) 0.4 < 5.0 mg/L
#              or  Fehérje Negatív Negatív            (non-numeric results)

SYNLAB_DATE = re.compile(r"Mintavétel:\s*([\d.]+)")


def is_unit_like(token: str) -> bool:
    return bool(UNIT_RE.fullmatch(token)) and bool(re.search(r"[A-Za-zµ°%]", token))


def looks_like_name_fragment(line: str, tokens) -> bool:
    """Wrapped continuation of a test name (no result on the line)."""
    return (len(tokens) <= 6 and not line.endswith((".", ":"))
            and not SECTION_TRAILING_RE.search(" ".join(tokens))
            and line.lower() not in SECTION_PHRASES)


def has_unbalanced_close(text: str) -> bool:
    """True if ')' appears before its matching '(' (continuation fragment)."""
    opens = closes = 0
    for ch in text:
        if ch == "(":
            opens += 1
        elif ch == ")":
            closes += 1
            if closes > opens:
                return True
    return False


def parse_synlab(lines):
    date = ""
    rows = []
    pending_name = ""
    for line in lines:
        line = line.strip()
        if not line:
            continue
        m = SYNLAB_DATE.search(line)
        if m:
            date = m.group(1).replace(".", "-")  # 2026.01.26 -> 2026-01-26
            continue
        if is_footer(line):
            continue
        tokens = line.split()

        # locate result: "<" / ">" operator + number, or bare number token
        idx = op_index = None
        prefix = ""
        for i, t in enumerate(tokens):
            if t in BOUND_OPS and i + 1 < len(tokens) \
                    and re.fullmatch(rf"{NUM}", tokens[i + 1]):
                idx, op_index, prefix = i + 1, i, t[0]
                break
            if re.fullmatch(rf"[<>]?{NUM}", t):
                idx = i
                break
        if idx is None:
            # section header: reset any pending name context
            if is_section_line(line):
                pending_name = ""
                continue
            # non-numeric result row: name <result-word> <ref> [unit]
            word_idx = next((i for i in range(1, len(tokens))
                             if tokens[i].lower() in WORD_RESULTS), None)
            if word_idx is None:
                if looks_like_name_fragment(line, tokens):
                    if has_unbalanced_close(line):
                        # continuation of the previous test's name
                        if rows:
                            rows[-1]["test"] = clean_name(
                                rows[-1]["test"] + " " + line, True)
                    else:
                        pending_name = (pending_name + " " + line).strip()
                continue
            name = " ".join(tokens[:word_idx]).strip()
            rest = tokens[word_idx + 1:]
            unit = rest.pop() if rest and is_unit_like(rest[-1]) else ""
            rows.append(make_row(date, pending_name + " " + name,
                                 tokens[word_idx], unit,
                                 clean_ref_text(rest), "", strip_caps=True))
            pending_name = ""
            continue

        result_token = tokens[idx]
        after = tokens[idx + 1:]
        if op_index is not None:
            name_tokens = tokens[:op_index]          # exclude the "<" operator
        else:
            name_tokens = tokens[:idx]

        # A "<"/">" prefix (attached to the number or a separate operator
        # token): it belongs to the result (<7.0 mg/L, no ref) or to the
        # reference column (0.4, ref < 5.0). If a ref-like token remains
        # besides the unit, it is a reference; otherwise it is the result.
        attached = ""
        if op_index is not None or result_token.startswith(("<", ">")):
            rest = after[:-1] if after and is_unit_like(after[-1]) else after
            if not any(re.fullmatch(rf"{NUM}", t) or REF_BOUND.search(t)
                       for t in rest):
                attached = prefix or result_token[0]

        result = result_token.lstrip("<>=").replace(",", ".")
        flag = ""
        while after and (after[0] in FLAGS or after[0] == "-"):
            if after[0] in FLAGS:
                flag = after.pop(0)
            else:
                after.pop(0)
        unit = ""
        ref_tokens = after
        if after and is_unit_like(after[-1]):
            unit = after.pop()
            ref_tokens = after
        ref_text = clean_ref_text(ref_tokens)
        if attached:
            result = attached + result
            ref_text = ""
        elif prefix and not attached:
            ref_text = (prefix + " " + ref_text).strip()
        elif ref_text and not REF_RANGE.search(ref_text):
            bm = REF_BOUND.match(ref_text)
            if bm:
                ref_text = (bm.group(1) + " " + bm.group(2)).strip()
        rows.append(make_row(date, pending_name + " " + " ".join(name_tokens),
                             result, unit, ref_text, flag, strip_caps=True))
        pending_name = ""
    return rows


def detect_format(first_page_text: str) -> str:
    return "synlab" if "Synlab" in first_page_text else "corden"


def main():
    in_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("example_data")
    out_csv = Path(sys.argv[2]) if len(sys.argv) > 2 else in_dir / "extracted.csv"

    all_rows = []
    for pdf_path in sorted(in_dir.glob("*.pdf")):
        with pdfplumber.open(pdf_path) as pdf:
            pages = [p.extract_text() or "" for p in pdf.pages]
        lines = [l for text in pages for l in text.splitlines()]
        fmt = detect_format(pages[0])
        parser = parse_synlab if fmt == "synlab" else parse_corden
        rows = parser(lines)
        for r in rows:
            r["file"] = pdf_path.name
        all_rows.extend(rows)
        print(f"{pdf_path.name}: {fmt}, {len(rows)} rows")

    with open(out_csv, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=[
            "file", "date", "test", "result", "unit",
            "ref_low", "ref_high", "ref_text", "flag"])
        w.writeheader()
        w.writerows(all_rows)
    print(f"wrote {out_csv}")


if __name__ == "__main__":
    main()
