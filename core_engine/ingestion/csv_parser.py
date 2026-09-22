"""
Parses CSV files into chunks. Unlike PDF/DOCX/TXT (plain prose, split by
character count), CSV rows are structured records — splitting mid-row
would break meaning. So this returns ready-made chunks directly, grouping
a few rows together, instead of going through the generic character-based
chunker.
"""
import csv
from typing import List


def parse_csv_to_chunks(file_path: str, source: str, rows_per_chunk: int = 5) -> List[dict]:
    """
    Reads a CSV file and returns chunks where each chunk contains a small
    group of rows, formatted as readable "column: value" lines so each
    chunk makes sense on its own when retrieved.
    """
    with open(file_path, "r", encoding="utf-8", errors="ignore", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    if not rows:
        return []

    chunks = []
    for i in range(0, len(rows), rows_per_chunk):
        row_group = rows[i:i + rows_per_chunk]
        row_texts = []
        for row in row_group:
            row_line = ", ".join(f"{key}: {value}" for key, value in row.items() if value)
            row_texts.append(row_line)

        chunks.append({
            "text": "\n".join(row_texts),
            "source": source,
            "chunk_index": i // rows_per_chunk,
        })

    return chunks
