"""Run PaddleOCR on selected PDF pages and write page-delimited UTF-8 text."""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from typing import Iterable


def parse_pages(value: str, total_pages: int) -> list[int]:
    """Parse unique, one-based PDF page numbers."""
    try:
        pages = [int(item.strip()) for item in value.split(",") if item.strip()]
    except ValueError as exc:
        raise ValueError("页码必须是用逗号分隔的整数") from exc

    if not pages:
        raise ValueError("至少指定一个 PDF 页码")
    if len(set(pages)) != len(pages):
        raise ValueError("PDF 页码不能重复")
    if any(page < 1 or page > total_pages for page in pages):
        raise ValueError(f"PDF 页码必须在 1 到 {total_pages} 之间")
    return pages


def format_page_text(pdf_page: int, lines: Iterable[str]) -> str:
    content = "\n".join(line.strip() for line in lines if line.strip())
    return f"===== PDF_PAGE {pdf_page} =====\n{content}\n"


def _extract_text_lines(results: Iterable[object]) -> list[str]:
    lines: list[str] = []
    for result in results:
        payload = getattr(result, "json", result)
        if callable(payload):
            payload = payload()
        if not isinstance(payload, dict):
            raise RuntimeError("PaddleOCR 返回了无法解析的结果")
        data = payload.get("res", payload)
        texts = data.get("rec_texts")
        if not isinstance(texts, list):
            raise RuntimeError("PaddleOCR 结果中缺少 rec_texts")
        lines.extend(str(text) for text in texts)
    return lines


def run_ocr(pdf_path: Path, pages: list[int], output_path: Path, dpi: int) -> dict:
    import pypdfium2 as pdfium
    from paddleocr import PaddleOCR

    engine = PaddleOCR(
        lang="ch",
        enable_mkldnn=False,
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )
    document = pdfium.PdfDocument(pdf_path)
    page_results = []
    output_parts = []

    try:
        for pdf_page in pages:
            started = time.perf_counter()
            page = document[pdf_page - 1]
            try:
                bitmap = page.render(scale=dpi / 72)
                image = bitmap.to_numpy()
                lines = _extract_text_lines(engine.predict(image))
            finally:
                page.close()

            elapsed_seconds = round(time.perf_counter() - started, 3)
            output_parts.append(format_page_text(pdf_page, lines))
            page_results.append(
                {
                    "pdf_page": pdf_page,
                    "line_count": len(lines),
                    "elapsed_seconds": elapsed_seconds,
                }
            )
    finally:
        document.close()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(output_parts), encoding="utf-8", newline="\n")
    return {
        "pdf": str(pdf_path),
        "output": str(output_path),
        "dpi": dpi,
        "language": "ch",
        "enable_mkldnn": False,
        "pages": page_results,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", type=Path, required=True, help="扫描版 PDF 路径")
    parser.add_argument("--pages", required=True, help="一基 PDF 页码，例如 6,7,10")
    parser.add_argument("--output", type=Path, required=True, help="UTF-8 原始 OCR 文本")
    parser.add_argument("--dpi", type=int, default=200, help="渲染分辨率，默认 200")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if not args.pdf.is_file():
        raise SystemExit(f"PDF 不存在：{args.pdf}")
    if args.dpi < 72:
        raise SystemExit("DPI 不能小于 72")

    import pypdfium2 as pdfium

    document = pdfium.PdfDocument(args.pdf)
    try:
        pages = parse_pages(args.pages, len(document))
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc
    finally:
        document.close()

    metadata = run_ocr(args.pdf, pages, args.output, args.dpi)
    metadata_path = args.output.with_suffix(".json")
    metadata_path.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print(json.dumps(metadata, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
