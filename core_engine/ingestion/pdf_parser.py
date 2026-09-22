"""
Extracts raw text from PDF files using pypdf.
"""
from pypdf import PdfReader


def parse_pdf(file_path: str) -> str:
    """Extracts and concatenates text from every page of a PDF."""
    reader = PdfReader(file_path)
    text_parts = []
    for page in reader.pages:
        page_text = page.extract_text() or ""
        text_parts.append(page_text)
    return "\n".join(text_parts)
