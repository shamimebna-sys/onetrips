from pathlib import Path
import fitz

root = Path(__file__).parent
for pdf in sorted(root.glob("ticket-*.pdf")):
    doc = fitz.open(pdf)
    print(f"{pdf.name} pages={doc.page_count}")
    for index, page in enumerate(doc, start=1):
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        out = root / f"{pdf.stem}-p{index}.png"
        pix.save(out)
        print(out)
