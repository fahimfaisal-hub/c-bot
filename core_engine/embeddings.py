"""
Thin abstraction so the rest of the codebase never cares which embedding
provider is active. Add a new provider by adding one branch here.

Config is resolved fresh on every call via
core_engine.storage.db.get_effective_embedding_config(), merging any
admin-panel override on top of .env defaults — same pattern as
core_engine/rag/llm_client.py.

Wrapped with the same LLMProviderError mapping as llm_client.py, so a bad
embedding key or provider outage surfaces as a clear error, not a raw 500.
"""
from typing import List
from core_engine.config import settings
from core_engine.errors import LLMProviderError
from core_engine.storage import db


def _get_embedding_config() -> dict:
    return db.get_effective_embedding_config({
        "provider": settings.embedding_provider,
        "api_key": settings.embedding_api_key,
        "model": settings.embedding_model,
    })


def embed_texts(texts: List[str]) -> List[List[float]]:
    """Returns a list of embedding vectors for the given texts."""
    cfg = _get_embedding_config()
    if cfg["provider"] == "openai":
        return _embed_openai(texts, cfg)
    elif cfg["provider"] == "gemini":
        return _embed_gemini(texts, cfg)
    elif cfg["provider"] == "local":
        return _embed_local(texts, cfg)
    else:
        raise LLMProviderError(f"Unsupported embedding provider: {cfg['provider']}", status_code=500)


def _embed_openai(texts: List[str], cfg: dict) -> List[List[float]]:
    from openai import OpenAI, AuthenticationError, RateLimitError, APIConnectionError
    # Always talks to api.openai.com directly, never a custom base_url —
    # OpenRouter and most other OpenAI-compatible proxies don't serve embeddings.
    try:
        client = OpenAI(api_key=cfg["api_key"])
        response = client.embeddings.create(model=cfg["model"], input=texts)
        return [item.embedding for item in response.data]
    except AuthenticationError:
        raise LLMProviderError(
            "The embedding provider rejected the API key. Check it in Bot Settings → AI Provider "
            "(OpenRouter keys don't work here — embeddings need a real OpenAI key, or use the local option).",
            status_code=401,
        )
    except RateLimitError:
        raise LLMProviderError(
            "The embedding provider's rate limit or quota was hit. Try again shortly.",
            status_code=429,
        )
    except APIConnectionError:
        raise LLMProviderError("Could not reach the embedding provider. Check your network connection.", status_code=502)
    except Exception as e:
        raise LLMProviderError(f"Unexpected error generating embeddings: {e}", status_code=502)


def _embed_gemini(texts: List[str], cfg: dict) -> List[List[float]]:
    import google.generativeai as genai
    try:
        genai.configure(api_key=cfg["api_key"])
        vectors = []
        for text in texts:
            result = genai.embed_content(model=cfg["model"], content=text)
            vectors.append(result["embedding"])
        return vectors
    except Exception as e:
        message = str(e).lower()
        if "api key" in message or "permission" in message or "unauthorized" in message:
            raise LLMProviderError(
                "The embedding provider rejected the API key. Check it in Bot Settings → AI Provider.",
                status_code=401,
            )
        raise LLMProviderError(f"Unexpected error generating embeddings: {e}", status_code=502)


# Cached model instances keyed by model name, so switching the local
# embedding model at runtime (via the admin panel) loads the new one
# without needing a restart, while still avoiding a reload on every call.
_local_models = {}


def _embed_local(texts: List[str], cfg: dict) -> List[List[float]]:
    """
    Fully free, no API key, runs on your own CPU/GPU via sentence-transformers.
    Default model (all-MiniLM-L6-v2) is ~80MB, downloads once on first run,
    then works fully offline. Good enough quality for most company FAQ/doc
    use cases; swap the model for a bigger one if you need more accuracy.
    """
    model_name = cfg["model"] or "all-MiniLM-L6-v2"
    try:
        if model_name not in _local_models:
            from sentence_transformers import SentenceTransformer
            _local_models[model_name] = SentenceTransformer(model_name)

        vectors = _local_models[model_name].encode(texts, convert_to_numpy=True)
        return vectors.tolist()
    except Exception as e:
        raise LLMProviderError(
            f"Failed to load or run the local embedding model ({model_name}). "
            f"First run needs internet access to download it. Error: {e}",
            status_code=502,
        )
