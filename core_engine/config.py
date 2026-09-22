"""
Central configuration for the RAG engine.
All values are read from environment variables (.env), so the same
codebase works for OpenAI, Gemini, or a local Llama server — the user
just changes .env, not the code.
"""
import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass
class Settings:
    # --- LLM provider ---
    llm_provider: str = os.getenv("LLM_PROVIDER", "openai")  # openai | gemini | local
    llm_api_key: str = os.getenv("LLM_API_KEY", "")
    llm_model: str = os.getenv("LLM_MODEL", "gpt-4o-mini")
    llm_base_url: str = os.getenv("LLM_BASE_URL", "")  # for local/self-hosted models

    # --- Embedding model ---
    # Separate key from LLM_API_KEY because providers like OpenRouter only
    # do LLM generation, not embeddings — you may need a real OpenAI/Gemini
    # key here even if your LLM_PROVIDER is "local" (e.g. OpenRouter).
    # Falls back to LLM_API_KEY if not set, for the common case where both
    # are the same provider (e.g. LLM_PROVIDER=openai, EMBEDDING_PROVIDER=openai).
    embedding_provider: str = os.getenv("EMBEDDING_PROVIDER", "openai")
    embedding_api_key: str = os.getenv("EMBEDDING_API_KEY", "") or os.getenv("LLM_API_KEY", "")
    embedding_model: str = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")

    # --- Vector store ---
    vector_db: str = os.getenv("VECTOR_DB", "chroma")  # chroma | faiss
    vector_db_path: str = os.getenv("VECTOR_DB_PATH", "./data/vectorstore")

    # --- Chunking ---
    chunk_size: int = int(os.getenv("CHUNK_SIZE", "800"))
    chunk_overlap: int = int(os.getenv("CHUNK_OVERLAP", "100"))

    # --- API auth (local, single-tenant: one shared secret) ---
    api_key: str = os.getenv("API_SECRET_KEY", "change-me")

    # --- Rate limiting (protects the public chat key from abuse) ---
    # Applies to /v1/chat and /v1/chat/stream only. 0 disables rate limiting.
    rate_limit_per_minute: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "20"))

    # --- Bot behavior ---
    bot_name: str = os.getenv("BOT_NAME", "Company Assistant")
    system_prompt: str = os.getenv(
        "SYSTEM_PROMPT",
        "You are a helpful assistant that answers questions strictly using "
        "the provided company context. If the answer is not in the context, "
        "say you don't have that information — do not make things up.",
    )
    top_k: int = int(os.getenv("TOP_K", "4"))


settings = Settings()
