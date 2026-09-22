"""
Wraps ChromaDB so the rest of the app never touches the vector DB
directly. This is also the seam where FAISS or another backend could
be swapped in later without touching API/RAG code.

Key design choice for the "auto-sync" feature: every chunk is stored
with its `source` as metadata. When a source is re-ingested, we first
delete all existing chunks for that source, then insert the new ones.
This gives cheap incremental re-sync without duplicating stale data.
"""
import uuid
import chromadb
from typing import List
from core_engine.config import settings
from core_engine.embeddings import embed_texts

_client = chromadb.PersistentClient(path=settings.vector_db_path)
_collection = _client.get_or_create_collection(name="company_knowledge_base")


def upsert_chunks(chunks: List[dict]) -> int:
    """
    Adds chunks to the vector store. If any chunks already exist for the
    same `source`, they are removed first (so re-uploading a doc replaces
    the old version instead of duplicating it).
    """
    if not chunks:
        return 0

    sources = {c["source"] for c in chunks}
    for source in sources:
        delete_by_source(source)

    texts = [c["text"] for c in chunks]
    embeddings = embed_texts(texts)
    ids = [str(uuid.uuid4()) for _ in chunks]
    metadatas = [{"source": c["source"], "chunk_index": c["chunk_index"]} for c in chunks]

    _collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=texts,
        metadatas=metadatas,
    )
    return len(chunks)


def delete_by_source(source: str) -> None:
    """Removes all chunks belonging to a given source (file name or URL)."""
    _collection.delete(where={"source": source})


def query(question: str, top_k: int = None) -> List[dict]:
    """Returns the top_k most relevant chunks for a question."""
    top_k = top_k or settings.top_k
    question_embedding = embed_texts([question])[0]

    results = _collection.query(
        query_embeddings=[question_embedding],
        n_results=top_k,
    )

    matches = []
    docs = results.get("documents", [[]])[0]
    metas = results.get("metadatas", [[]])[0]
    for doc, meta in zip(docs, metas):
        matches.append({"text": doc, "source": meta.get("source")})
    return matches


def list_sources() -> List[str]:
    """Returns the unique list of ingested source names (for the admin UI)."""
    data = _collection.get()
    sources = {m.get("source") for m in data.get("metadatas", []) if m}
    return sorted(sources)


def stats() -> dict:
    return {"total_chunks": _collection.count(), "total_sources": len(list_sources())}
