# Book index tools

These scripts produce `app/src/main/assets/book/masail.tsv` and `headings.tsv` from `urdu-tozih.pdf`.
The PDF's Nastaleeq fonts have no Unicode text, so the text is recovered with OCR. It is used only to
*find* a masla; the app always shows the real printed paragraph cropped from the PDF.

1. `ocr_tsv.sh <page>` – OCR one page with Tesseract (`urd`, tessdata_best) to TSV with line positions.
   Run for pages 1–542 (edit the paths at the top).
2. `locate_headings.py <workdir>` – finds each table-of-contents heading from `toc.tsv` on its page.
   `toc.tsv` was transcribed by hand from the book's own contents pages (2–15):
   `printed heading <TAB> page <TAB> extra search words`.
3. `build_masail.py <workdir> <outdir> <TauzihDatabase.kt>` – splits every page into masail
   (paragraphs), forces a break at each heading, and estimates masla numbers.
