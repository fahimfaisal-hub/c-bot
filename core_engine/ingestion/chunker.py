"""
Splits raw text into overlapping chunks suitable for embedding.
Kept simple and dependency-light (no heavy NLP libs) so the framework
stays easy to install and audit.
"""
from typing import List
from core_engine.config import settings


def chunk_text(text: str, source: str, chunk_size: int = None, overlap: int = None) -> List[dict]:
    """
    Splits text into overlapping chunks.
    Returns a list of dicts: {"text": ..., "source": ..., "chunk_index": ...}
    """
    chunk_size = chunk_size or settings.chunk_size
    overlap = overlap or settings.chunk_overlap

    text = " ".join(text.split())  # normalize whitespace
    if not text:
        return []

    chunks = []
    start = 0
    index = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        # try not to cut mid-word
        if end < len(text):
            last_space = text.rfind(" ", start, end)
            if last_space > start:
                end = last_space

        chunk = text[start:end].strip()
        if chunk:
            chunks.append({
                "text": chunk,
                "source": source,
                "chunk_index": index,
            })
            index += 1

        if end >= len(text):
            break
        start = max(end - overlap, start + 1)

    return chunks
