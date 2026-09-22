"""
Thin LLM call abstraction — mirrors core_engine/embeddings.py so adding
a new LLM provider only requires one new branch, never touching the
retriever or API layer.

Config (provider/model/base_url/api_key) is resolved fresh on every call
via core_engine.storage.db.get_effective_llm_config(), which merges any
admin-panel override on top of the .env defaults. This is what lets
changing the provider/model/key from the admin panel apply to the very
next question, with no server restart.

Every provider function is wrapped so failures (bad key, rate limit,
network/provider outage) raise LLMProviderError with a clear message and
correct HTTP status code, instead of an unhandled exception turning into
a generic 500 with a Python traceback leaking to the client.

Each provider also has a streaming variant, used by the /v1/chat/stream
SSE endpoint, yielding text chunks as they arrive.
"""
from typing import Iterator
from core_engine.config import settings
from core_engine.errors import LLMProviderError
from core_engine.storage import db


def _get_llm_config() -> dict:
    return db.get_effective_llm_config({
        "provider": settings.llm_provider,
        "api_key": settings.llm_api_key,
        "model": settings.llm_model,
        "base_url": settings.llm_base_url,
    })


def generate_answer(messages: list) -> str:
    cfg = _get_llm_config()
    if cfg["provider"] in ("openai", "local"):
        return _generate_openai(messages, cfg)
    elif cfg["provider"] == "gemini":
        return _generate_gemini(messages, cfg)
    else:
        raise LLMProviderError(f"Unsupported LLM provider: {cfg['provider']}", status_code=500)


def generate_answer_stream(messages: list) -> Iterator[str]:
    """Yields the answer as it's generated, chunk by chunk."""
    cfg = _get_llm_config()
    if cfg["provider"] in ("openai", "local"):
        yield from _generate_openai_compatible_stream(messages, cfg)
    elif cfg["provider"] == "gemini":
        yield from _generate_gemini_stream(messages, cfg)
    else:
        raise LLMProviderError(f"Unsupported LLM provider: {cfg['provider']}", status_code=500)


# ---------- OpenAI (and any OpenAI-compatible endpoint: OpenRouter, Ollama, vLLM) ----------

def _openai_client(cfg: dict):
    from openai import OpenAI
    if cfg["provider"] == "local":
        return OpenAI(api_key=cfg["api_key"] or "not-needed", base_url=cfg["base_url"])
    return OpenAI(api_key=cfg["api_key"])


def _map_openai_error(e: Exception) -> LLMProviderError:
    """Turns openai-sdk exceptions into a clear, user-facing message + status code."""
    from openai import AuthenticationError, RateLimitError, APIConnectionError, APIStatusError

    if isinstance(e, AuthenticationError):
        return LLMProviderError(
            "The LLM provider rejected the API key. Check it in Bot Settings → AI Provider (or LLM_API_KEY in .env).",
            status_code=401,
        )
    if isinstance(e, RateLimitError):
        return LLMProviderError(
            "The LLM provider's rate limit or quota was hit. Try again shortly, or check your plan/credits.",
            status_code=429,
        )
    if isinstance(e, APIConnectionError):
        return LLMProviderError(
            "Could not reach the LLM provider. Check the base URL and your network connection.",
            status_code=502,
        )
    if isinstance(e, APIStatusError):
        return LLMProviderError(
            f"The LLM provider returned an error (status {e.status_code}). {str(e)[:200]}",
            status_code=502,
        )
    return LLMProviderError(f"Unexpected error calling the LLM provider: {e}", status_code=502)


def _generate_openai(messages: list, cfg: dict) -> str:
    try:
        client = _openai_client(cfg)
        response = client.chat.completions.create(
            model=cfg["model"], messages=messages, temperature=0.3,
        )
        return response.choices[0].message.content
    except LLMProviderError:
        raise
    except Exception as e:
        raise _map_openai_error(e)


def _generate_openai_compatible_stream(messages: list, cfg: dict) -> Iterator[str]:
    try:
        client = _openai_client(cfg)
        stream = client.chat.completions.create(
            model=cfg["model"], messages=messages, temperature=0.3, stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                yield delta
    except LLMProviderError:
        raise
    except Exception as e:
        raise _map_openai_error(e)


# ---------- Gemini ----------

def _map_gemini_error(e: Exception) -> LLMProviderError:
    message = str(e).lower()
    if "api key" in message or "permission" in message or "unauthorized" in message:
        return LLMProviderError(
            "The LLM provider rejected the API key. Check it in Bot Settings → AI Provider (or LLM_API_KEY in .env).",
            status_code=401,
        )
    if "quota" in message or "rate" in message:
        return LLMProviderError(
            "The LLM provider's rate limit or quota was hit. Try again shortly.",
            status_code=429,
        )
    return LLMProviderError(f"Unexpected error calling Gemini: {e}", status_code=502)


def _generate_gemini(messages: list, cfg: dict) -> str:
    try:
        import google.generativeai as genai
        genai.configure(api_key=cfg["api_key"])
        model = genai.GenerativeModel(cfg["model"])
        prompt = "\n\n".join(f"{m['role'].upper()}: {m['content']}" for m in messages)
        response = model.generate_content(prompt)
        return response.text
    except LLMProviderError:
        raise
    except Exception as e:
        raise _map_gemini_error(e)


def _generate_gemini_stream(messages: list, cfg: dict) -> Iterator[str]:
    try:
        import google.generativeai as genai
        genai.configure(api_key=cfg["api_key"])
        model = genai.GenerativeModel(cfg["model"])
        prompt = "\n\n".join(f"{m['role'].upper()}: {m['content']}" for m in messages)
        response = model.generate_content(prompt, stream=True)
        for chunk in response:
            if chunk.text:
                yield chunk.text
    except LLMProviderError:
        raise
    except Exception as e:
        raise _map_gemini_error(e)
