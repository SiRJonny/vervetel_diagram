import pdfplumber

files = [
    "example_data/ehr-document--242305405904748856--1.pdf",
    "example_data/ehr-document--242600654638875309--2.pdf",
]
for f in files:
    print("=" * 20, f)
    with pdfplumber.open(f) as pdf:
        for i, p in enumerate(pdf.pages):
            print(f"--- page {i + 1} ---")
            print(p.extract_text() or "(no text layer)")
