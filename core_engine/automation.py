"""
Lightweight in-process scheduler for two automation features, both
configurable from the admin panel without a restart:

1. Log auto-clear — deletes chat logs older than N days.
2. Scheduled auto-sync — re-scrapes every URL source on a fixed interval,
   so a company doesn't have to remember to hit "re-sync" manually.

No extra dependency (no APScheduler/Celery) — a single asyncio loop that
wakes up every few minutes and checks "is it time yet?" against
timestamps stored in SQLite. Fine for a self-hosted, single-instance
deployment; a multi-worker production setup would want a real scheduler
or cron instead.
"""
import asyncio
import logging
from datetime import datetime, timezone

from core_engine.storage import db
from core_engine.ingestion import load_and_chunk_url
from core_engine.vectorstore import store_manager

logger = logging.getLogger("automation")

# How often the loop wakes up to check whether cleanup/sync is due.
# Independent of the user-configured retention/sync intervals themselves.
_CHECK_INTERVAL_SECONDS = 5 * 60


def _hours_since(iso_timestamp: str) -> float:
    then = datetime.fromisoformat(iso_timestamp)
    now = datetime.now(timezone.utc)
    return (now - then).total_seconds() / 3600


def run_log_cleanup_if_due() -> None:
    settings = db.get_automation_settings()
    retention_days = settings["log_retention_days"]
    if retention_days <= 0:
        return  # disabled

    last_run = settings["last_log_cleanup_at"]
    # Run at most once per day, regardless of retention_days value.
    if last_run and _hours_since(last_run) < 24:
        return

    deleted = db.delete_logs_older_than(retention_days)
    db.mark_log_cleanup_ran()
    logger.info(f"[automation] Log cleanup ran: deleted {deleted} logs older than {retention_days} days.")


def run_auto_sync_if_due() -> None:
    settings = db.get_automation_settings()
    if not settings["auto_sync_enabled"]:
        return

    interval_hours = settings["auto_sync_interval_hours"]
    last_run = settings["last_auto_sync_at"]
    if last_run and _hours_since(last_run) < interval_hours:
        return

    url_sources = [s for s in store_manager.list_sources() if s.startswith("http")]
    for url in url_sources:
        try:
            chunks = load_and_chunk_url(url)
            store_manager.upsert_chunks(chunks)
            logger.info(f"[automation] Auto-synced {url}: {len(chunks)} chunks.")
        except Exception as e:
            # One failing URL (e.g. temporarily down) shouldn't stop the rest.
            logger.warning(f"[automation] Auto-sync failed for {url}: {e}")

    db.mark_auto_sync_ran()


def run_sync_all_now() -> dict:
    """Manual trigger (admin panel 'Sync now' button) — bypasses the interval check."""
    url_sources = [s for s in store_manager.list_sources() if s.startswith("http")]
    synced, failed = [], []
    for url in url_sources:
        try:
            chunks = load_and_chunk_url(url)
            store_manager.upsert_chunks(chunks)
            synced.append(url)
        except Exception as e:
            failed.append({"url": url, "error": str(e)})
    db.mark_auto_sync_ran()
    return {"synced": synced, "failed": failed}


async def automation_loop():
    """Runs forever in the background, started from FastAPI's lifespan."""
    while True:
        try:
            # Blocking work (network calls, embeddings) runs in a thread so
            # it never freezes the API server's event loop.
            await asyncio.to_thread(run_log_cleanup_if_due)
            await asyncio.to_thread(run_auto_sync_if_due)
        except Exception as e:
            logger.error(f"[automation] Loop iteration failed: {e}")
        await asyncio.sleep(_CHECK_INTERVAL_SECONDS)
