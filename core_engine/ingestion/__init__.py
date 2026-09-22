"""
Ingestion entrypoint: given a file path or URL, extract text and return
ready-to-embed chunks. This is the single function the API layer calls,
regardless of source type.
"""
import os
from typing import List
from core_engine.ingestion.pdf_parser import parse_pdf
from core_engine.ingestion.docx_parser import parse_docx
from core_engine.ingestion.csv_parser import parse_csv_to_chunks
from core_engine.ingestion.web_scraper import scrape_url
from core_engine.ingestion.chunker import chunk_text
from core_engine.errors import IngestionError

SUPPORTED_FILE_EXTENSIONS = (".pdf", ".docx", ".csv", ".txt", ".md")


def load_and_chunk_file(file_path: str) -> List[dict]:
    """Reads a local file (pdf, docx, csv, txt, md) and returns chunks."""
    ext = os.path.splitext(file_path)[1].lower()
    source_name = os.path.basename(file_path)

    try:
        if ext == ".pdf":
            raw_text = parse_pdf(file_path)
            chunks = chunk_text(raw_text, source=source_name)
        elif ext == ".docx":
            raw_text = parse_docx(file_path)
            chunks = chunk_text(raw_text, source=source_name)
        elif ext == ".csv":
            # CSV gets its own row-aware chunking instead of character-splitting,
            # so a chunk never cuts a record in half.
            chunks = parse_csv_to_chunks(file_path, source=source_name)
        elif ext in (".txt", ".md"):
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                raw_text = f.read()
            chunks = chunk_text(raw_text, source=source_name)
        else:
            raise IngestionError(
                f"Unsupported file type: {ext}. Supported: {', '.join(SUPPORTED_FILE_EXTENSIONS)}"
            )
    except IngestionError:
        raise
    except Exception as e:
        raise IngestionError(f"Failed to parse {source_name}: {e}")

    if not chunks:
        raise IngestionError(f"{source_name} appears to be empty or contains no extractable text.")

    return chunks


def load_and_chunk_url(url: str) -> List[dict]:
    """Scrapes a URL and returns chunks."""
    raw_text = scrape_url(url)  # already raises IngestionError on failure
    chunks = chunk_text(raw_text, source=url)
    if not chunks:
        raise IngestionError(f"No usable text content extracted from {url}.")
    return chunks
