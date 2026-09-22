"""
Lightweight SQLite store for two things that don't belong in .env because
they need to change without a server restart:

1. Runtime settings (currently: system_prompt) — editable from the admin
   panel. Falls back to the .env value until someone overrides it here.
2. Chat logs — every question, the exact final prompt sent to the LLM,
   the answer, retrieved sources, and whether it looked "unanswered".
   This is what powers the Prompt Log / Unanswered Questions admin views.

SQLite (not Chroma) because this is simple relational/append-only data —
no vector search needed here, and it keeps the vector store solely for
embeddings.
"""
import sqlite3
import os
import json
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from core_engine.config import settings

_DB_PATH = os.path.join(os.path.dirname(settings.vector_db_path), "app.db") \
    if os.path.dirname(settings.vector_db_path) else "./data/app.db"
os.makedirs(os.path.dirname(_DB_PATH), exist_ok=True)


def _get_conn():
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db():
    conn = _get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS chat_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            question TEXT NOT NULL,
            final_prompt TEXT NOT NULL,
            answer TEXT NOT NULL,
            sources TEXT NOT NULL,
            is_unanswered INTEGER NOT NULL DEFAULT 0
        )
    """)
    conn.commit()
    conn.close()


_init_db()


# ---------- Runtime settings (e.g. editable system prompt) ----------

def get_setting(key: str, default: Optional[str] = None) -> Optional[str]:
    conn = _get_conn()
    row = conn.execute("SELECT value FROM app_settings WHERE key = ?", (key,)).fetchone()
    conn.close()
    return row["value"] if row else default


def set_setting(key: str, value: str) -> None:
    conn = _get_conn()
    conn.execute(
        "INSERT INTO app_settings (key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value),
    )
    conn.commit()
    conn.close()


# ---------- Chat / prompt logs ----------

# Heuristic used to flag an answer as "unanswered". Kept simple and
# transparent on purpose — a company can tune this phrase via the
# system prompt itself (the model is told to say exactly this when it
# doesn't know), so the check stays reliable without extra LLM calls.
_UNANSWERED_MARKERS = ["don't have that information", "do not have that information"]


def log_chat(question: str, final_prompt: str, answer: str, sources: List[str]) -> None:
    is_unanswered = any(marker in answer.lower() for marker in _UNANSWERED_MARKERS)
    conn = _get_conn()
    conn.execute(
        "INSERT INTO chat_logs (timestamp, question, final_prompt, answer, sources, is_unanswered) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (
            datetime.now(timezone.utc).isoformat(),
            question,
            final_prompt,
            answer,
            json.dumps(sources),
            int(is_unanswered),
        ),
    )
    conn.commit()
    conn.close()


def get_logs(limit: int = 50, unanswered_only: bool = False) -> List[dict]:
    conn = _get_conn()
    query = "SELECT * FROM chat_logs"
    if unanswered_only:
        query += " WHERE is_unanswered = 1"
    query += " ORDER BY id DESC LIMIT ?"
    rows = conn.execute(query, (limit,)).fetchall()
    conn.close()

    return [
        {
            "id": row["id"],
            "timestamp": row["timestamp"],
            "question": row["question"],
            "final_prompt": row["final_prompt"],
            "answer": row["answer"],
            "sources": json.loads(row["sources"]),
            "is_unanswered": bool(row["is_unanswered"]),
        }
        for row in rows
    ]


def get_log_stats() -> dict:
    conn = _get_conn()
    total = conn.execute("SELECT COUNT(*) c FROM chat_logs").fetchone()["c"]
    unanswered = conn.execute("SELECT COUNT(*) c FROM chat_logs WHERE is_unanswered = 1").fetchone()["c"]
    conn.close()
    return {"total_questions": total, "unanswered_questions": unanswered}


def clear_logs() -> None:
    conn = _get_conn()
    conn.execute("DELETE FROM chat_logs")
    conn.commit()
    conn.close()


def delete_logs_older_than(days: int) -> int:
    """Deletes chat logs older than N days. Returns count deleted."""
    conn = _get_conn()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    cursor = conn.execute("DELETE FROM chat_logs WHERE timestamp < ?", (cutoff,))
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    return deleted


# ---------- Automation settings (log retention + scheduled auto-sync) ----------
# Stored as simple key/value rows in app_settings so they're editable from
# the admin panel at runtime, same pattern as system_prompt.

def get_automation_settings() -> dict:
    return {
        "log_retention_days": int(get_setting("log_retention_days", "0")),  # 0 = disabled
        "last_log_cleanup_at": get_setting("last_log_cleanup_at"),
        "auto_sync_enabled": get_setting("auto_sync_enabled", "false") == "true",
        "auto_sync_interval_hours": int(get_setting("auto_sync_interval_hours", "24")),
        "last_auto_sync_at": get_setting("last_auto_sync_at"),
    }


def set_log_retention_days(days: int) -> None:
    set_setting("log_retention_days", str(days))


def set_auto_sync(enabled: bool, interval_hours: int) -> None:
    set_setting("auto_sync_enabled", "true" if enabled else "false")
    set_setting("auto_sync_interval_hours", str(interval_hours))


def mark_log_cleanup_ran() -> None:
    set_setting("last_log_cleanup_at", datetime.now(timezone.utc).isoformat())


def mark_auto_sync_ran() -> None:
    set_setting("last_auto_sync_at", datetime.now(timezone.utc).isoformat())


# ---------- Public chat key ----------
# A SEPARATE key from API_SECRET_KEY (the admin key). This one is meant to
# be embedded in public-facing frontends (the default widget, a custom
# chat UI) — visible in page source is expected and fine. It only unlocks
# /v1/chat and /v1/chat/stream, never the /v1/admin/* or ingestion routes.
# Auto-generated on first use if not set; rotatable from the admin panel.

def get_chat_public_key() -> str:
    key = get_setting("chat_public_key")
    if not key:
        key = secrets.token_urlsafe(24)
        set_setting("chat_public_key", key)
    return key


def regenerate_chat_public_key() -> str:
    """Rotates the public chat key — any previously embedded widget stops working."""
    new_key = secrets.token_urlsafe(24)
    set_setting("chat_public_key", new_key)
    return new_key


# ---------- Allowed chat domains (Origin restriction for the public key) ----------
# Comma-separated hostnames (e.g. "yourcompany.com,www.yourcompany.com").
# Empty = no restriction (any origin can use the public chat key, relying
# only on scope + rate limiting). Setting this closes the "copy the key
# from page source, use it on a totally different site" gap.

def get_allowed_chat_domains() -> list:
    raw = get_setting("allowed_chat_domains", "")
    return [d.strip().lower() for d in raw.split(",") if d.strip()]


def set_allowed_chat_domains(domains: list) -> None:
    cleaned = [d.strip().lower() for d in domains if d.strip()]
    set_setting("allowed_chat_domains", ",".join(cleaned))


# ---------- AI provider settings (runtime-editable from the admin panel) ----------
# Provider/model/base_url are plain settings, same pattern as system_prompt.
# API keys are handled differently on purpose: WRITE-ONLY. They can be set
# or replaced from the admin panel, but no function here ever returns the
# actual key value back out — only whether one is currently set. This
# keeps the risk profile the same as editing .env by hand (a key sitting
# on disk), instead of adding a new way for a compromised admin session
# to read live provider keys back out through the API.

def get_provider_settings() -> dict:
    """Returns effective provider/model/base_url (db override or None) plus whether keys are set."""
    return {
        "llm_provider": get_setting("provider_llm_provider"),
        "llm_model": get_setting("provider_llm_model"),
        "llm_base_url": get_setting("provider_llm_base_url"),
        "llm_api_key_set": bool(get_setting("provider_llm_api_key")),
        "embedding_provider": get_setting("provider_embedding_provider"),
        "embedding_model": get_setting("provider_embedding_model"),
        "embedding_api_key_set": bool(get_setting("provider_embedding_api_key")),
    }


def update_llm_provider_settings(provider: str, model: str, base_url: str, api_key: Optional[str]) -> None:
    set_setting("provider_llm_provider", provider)
    set_setting("provider_llm_model", model)
    set_setting("provider_llm_base_url", base_url or "")
    # Only overwrite the stored key if a new non-empty value was given —
    # an empty/omitted value means "keep the existing key", not "clear it".
    if api_key:
        set_setting("provider_llm_api_key", api_key)


def update_embedding_provider_settings(provider: str, model: str, api_key: Optional[str]) -> None:
    set_setting("provider_embedding_provider", provider)
    set_setting("provider_embedding_model", model)
    if api_key:
        set_setting("provider_embedding_api_key", api_key)


def get_effective_llm_config(env_defaults: dict) -> dict:
    """
    Merges db overrides on top of .env defaults. Called on every LLM
    request (not cached) so a change from the admin panel applies to the
    very next question, no restart needed.
    """
    return {
        "provider": get_setting("provider_llm_provider") or env_defaults["provider"],
        "api_key": get_setting("provider_llm_api_key") or env_defaults["api_key"],
        "model": get_setting("provider_llm_model") or env_defaults["model"],
        "base_url": get_setting("provider_llm_base_url") or env_defaults["base_url"],
    }


def get_effective_embedding_config(env_defaults: dict) -> dict:
    return {
        "provider": get_setting("provider_embedding_provider") or env_defaults["provider"],
        "api_key": get_setting("provider_embedding_api_key") or env_defaults["api_key"],
        "model": get_setting("provider_embedding_model") or env_defaults["model"],
    }
