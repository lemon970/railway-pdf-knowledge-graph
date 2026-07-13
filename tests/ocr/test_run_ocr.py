import pytest

from scripts.ocr.run_ocr import format_page_text, parse_pages


def test_parse_pages_accepts_comma_separated_pdf_page_numbers():
    assert parse_pages("6,7,10", total_pages=52) == [6, 7, 10]


@pytest.mark.parametrize("value", ["", "0", "53", "6,6", "six"])
def test_parse_pages_rejects_invalid_page_selection(value):
    with pytest.raises(ValueError):
        parse_pages(value, total_pages=52)


def test_format_page_text_adds_page_marker_and_preserves_lines():
    text = format_page_text(6, ["4.3.1 轮对", "车轮直径小于 Φ800mm"])

    assert text == (
        "===== PDF_PAGE 6 =====\n"
        "4.3.1 轮对\n"
        "车轮直径小于 Φ800mm\n"
    )
