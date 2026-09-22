"""
FastAPI server exposing the RAG engine.

Two consumer types call these routes, with two different keys:
1. The admin panel (document management, bot settings, logs) — uses
   API_SECRET_KEY (the admin key). Never expose this in a public frontend.
2. Any chat frontend — the default widget or a company's custom UI — uses
   a separate public chat key (see core_engine/storage/db.py), which only
   unlocks /v1/chat and /v1/chat/stream. It's expected to be visible in
   page source (embedded in widget HTML), so it's scoped to do nothing
   else, and rate-limited to prevent abuse if scraped from a page.
"""
import os
import json
import shutil
import tempfile
import asyncio
from contextlib import asynccontextmanager
from urllib.parse import urlparse
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from core_engine.config import settings
from core_engine.errors import LLMProviderError, IngestionError
from core_engine.ingestion import load_and_chunk_file, load_and_chunk_url
from core_engine.vectorstore import store_manager
from core_engine.rag.retriever import answer_question, answer_question_stream
from core_engine.rag.prompt_templates import get_active_system_prompt
from core_engine.storage import db
from core_engine.automation import automation_loop, run_sync_all_now
from core_engine.ratelimit import check_rate_limit
from api_server.schemas import (
    ChatRequest, ChatResponse, IngestUrlRequest, IngestResponse,
    SourceListResponse, DeleteSourceRequest, BotConfigResponse,
    UpdateSystemPromptRequest, ChatLogListResponse,
    AutomationSettingsResponse, UpdateLogRetentionRequest, UpdateAutoSyncRequest,
    ChatPublicKeyResponse, AllowedDomainsResponse, UpdateAllowedDomainsRequest,
    ProviderSettingsResponse, UpdateLlmProviderRequest, UpdateEmbeddingProviderRequest,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Background task for log auto-clear + scheduled URL auto-sync.
    # Both are no-ops until enabled from the admin panel, so this is safe
    # to always run.
    task = asyncio.create_task(automation_loop())
    yield
    task.cancel()


app = FastAPI(
    title="C-Bot API",
    description="Self-hosted RAG engine for company chatbots.",
    version="0.1.0",
    lifespan=lifespan,
)

# Wide-open CORS by default because a company's custom UI may be served
# from any domain. For production, restrict via ALLOWED_ORIGINS in .env.
allowed_origins = os.getenv("ALLOWED_ORIGINS", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[allowed_origins] if allowed_origins != "*" else ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Global error handlers ----------
# These turn LLMProviderError / IngestionError (raised anywhere in
# core_engine) into clean JSON responses with the right HTTP status code,
# instead of a raw 500 + Python traceback reaching the client.

@app.exception_handler(LLMProviderError)
async def llm_provider_error_handler(request: Request, exc: LLMProviderError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


@app.exception_handler(IngestionError)
async def ingestion_error_handler(request: Request, exc: IngestionError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


def verify_admin_key(x_api_key: str = Header(default="")):
    """Guards /v1/admin/*, ingestion, and source-management routes. Never expose this key client-side."""
    if x_api_key != settings.api_key:
        raise HTTPException(status_code=401, detail="Invalid or missing admin API key")
    return True


def _request_hostname(request: Request) -> str | None:
    """Extracts the hostname from a request's Origin header, falling back to Referer."""
    origin = request.headers.get("origin") or request.headers.get("referer")
    if not origin:
        return None
    try:
        return urlparse(origin).hostname
    except ValueError:
        return None


def verify_chat_key(request: Request, x_api_key: str = Header(default="")):
    """
    Guards /v1/chat and /v1/chat/stream. Accepts either the public chat
    key (meant to be embedded in widgets/custom UIs) or the admin key
    (so the admin panel and API docs can test chat without a second key).

    If allowed_chat_domains is configured (admin panel/Integration page),
    requests authenticated with the PUBLIC key must also come from an
    allowed origin — so a key copied out of page source and reused on a
    different site is rejected even before rate limiting kicks in. This
    check only applies to browser-originated requests (ones that send an
    Origin/Referer header); non-browser clients using the public key are
    unaffected since they can't be checked this way — domain restriction
    is a defense specifically against "steal the key from a website".
    """
    if x_api_key == settings.api_key:
        return True  # admin key: trusted, no domain restriction

    if not (x_api_key and x_api_key == db.get_chat_public_key()):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")

    allowed_domains = db.get_allowed_chat_domains()
    if allowed_domains:
        hostname = _request_hostname(request)
        if hostname and hostname not in allowed_domains:
            raise HTTPException(
                status_code=403,
                detail=f"This chat key isn't authorized for requests from '{hostname}'.",
            )

    return True


def rate_limited_chat(request: Request, _auth: bool = Depends(verify_chat_key)):
    """Combines auth + domain check + per-IP rate limiting for the two chat endpoints."""
    client_ip = request.client.host if request.client else "unknown"
    check_rate_limit(client_ip)
    return True


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/v1/config", response_model=BotConfigResponse)
def get_bot_config():
    """Public: lets any chat UI (widget or custom) fetch bot display info."""
    return BotConfigResponse(
        bot_name=settings.bot_name,
        system_prompt=get_active_system_prompt(),
        llm_provider=settings.llm_provider,
        llm_model=settings.llm_model,
    )


@app.get("/v1/admin/system-prompt")
def get_system_prompt(_auth: bool = Depends(verify_admin_key)):
    """Admin-only: returns the currently active system prompt (override or .env default)."""
    return {"system_prompt": get_active_system_prompt()}


@app.put("/v1/admin/system-prompt")
def update_system_prompt(request: UpdateSystemPromptRequest, _auth: bool = Depends(verify_admin_key)):
    """
    Admin-only: overrides the system prompt at runtime, no server restart
    needed. Persisted in SQLite, survives restarts too.
    """
    db.set_setting("system_prompt", request.system_prompt)
    return {"system_prompt": request.system_prompt}


@app.get("/v1/admin/logs", response_model=ChatLogListResponse)
def get_chat_logs(limit: int = 50, unanswered_only: bool = False, _auth: bool = Depends(verify_admin_key)):
    """
    Admin-only: every question asked, the exact final prompt sent to the
    LLM, the answer, and whether it looked unanswered. Use unanswered_only=true
    to see knowledge-base gaps.
    """
    logs = db.get_logs(limit=limit, unanswered_only=unanswered_only)
    stats = db.get_log_stats()
    return ChatLogListResponse(logs=logs, **stats)


@app.delete("/v1/admin/logs")
def clear_chat_logs(_auth: bool = Depends(verify_admin_key)):
    """Admin-only: clears all chat logs."""
    db.clear_logs()
    return {"cleared": True}


@app.get("/v1/admin/automation", response_model=AutomationSettingsResponse)
def get_automation_settings(_auth: bool = Depends(verify_admin_key)):
    """Admin-only: current log-retention and auto-sync configuration."""
    return AutomationSettingsResponse(**db.get_automation_settings())


@app.put("/v1/admin/automation/log-retention")
def update_log_retention(request: UpdateLogRetentionRequest, _auth: bool = Depends(verify_admin_key)):
    """
    Admin-only: sets how many days of chat logs to keep. 0 disables
    auto-clear entirely (logs are kept forever until manually cleared).
    A background check runs at most once a day.
    """
    db.set_log_retention_days(request.retention_days)
    return {"log_retention_days": request.retention_days}


@app.put("/v1/admin/automation/auto-sync")
def update_auto_sync(request: UpdateAutoSyncRequest, _auth: bool = Depends(verify_admin_key)):
    """
    Admin-only: enables/disables scheduled re-syncing of all URL sources,
    and sets the interval in hours. Takes effect on the next background
    check (within ~5 minutes), no restart needed.
    """
    db.set_auto_sync(enabled=request.enabled, interval_hours=request.interval_hours)
    return {"auto_sync_enabled": request.enabled, "auto_sync_interval_hours": request.interval_hours}


@app.post("/v1/admin/sync-all-now")
def sync_all_now(_auth: bool = Depends(verify_admin_key)):
    """Admin-only: manually re-syncs every URL source immediately, ignoring the interval."""
    return run_sync_all_now()


@app.get("/v1/admin/chat-key", response_model=ChatPublicKeyResponse)
def get_chat_public_key(_auth: bool = Depends(verify_admin_key)):
    """
    Admin-only: returns the current public chat key. This is the key to
    embed in the default widget or a custom UI — it only unlocks
    /v1/chat and /v1/chat/stream, never admin routes. Safe to expose in
    page source. Auto-generated on first call if one doesn't exist yet.
    """
    return ChatPublicKeyResponse(chat_public_key=db.get_chat_public_key())


@app.post("/v1/admin/chat-key/regenerate", response_model=ChatPublicKeyResponse)
def regenerate_chat_public_key(_auth: bool = Depends(verify_admin_key)):
    """
    Admin-only: rotates the public chat key. Any widget/UI embedding the
    old key immediately stops working — use this if a key may have leaked
    or you just want to invalidate old embeds.
    """
    return ChatPublicKeyResponse(chat_public_key=db.regenerate_chat_public_key())


@app.get("/v1/admin/allowed-domains", response_model=AllowedDomainsResponse)
def get_allowed_domains(_auth: bool = Depends(verify_admin_key)):
    """
    Admin-only: lists domains allowed to use the public chat key. Empty
    list = no restriction (any origin can use it, relying on scope +
    rate limiting alone).
    """
    return AllowedDomainsResponse(allowed_domains=db.get_allowed_chat_domains())


@app.put("/v1/admin/allowed-domains", response_model=AllowedDomainsResponse)
def update_allowed_domains(request: UpdateAllowedDomainsRequest, _auth: bool = Depends(verify_admin_key)):
    """
    Admin-only: sets which domains may use the public chat key (matched
    against the request's Origin/Referer header). Takes effect immediately.
    """
    db.set_allowed_chat_domains(request.allowed_domains)
    return AllowedDomainsResponse(allowed_domains=db.get_allowed_chat_domains())


@app.get("/v1/admin/provider-settings", response_model=ProviderSettingsResponse)
def get_provider_settings(_auth: bool = Depends(verify_admin_key)):
    """
    Admin-only: current LLM/embedding provider, model, and base URL
    (db override if set, else the .env default), plus whether an
    admin-panel API key override is set. Actual key values are never
    returned — write-only by design (see core_engine/storage/db.py).
    """
    saved = db.get_provider_settings()
    return ProviderSettingsResponse(
        llm_provider=saved["llm_provider"] or settings.llm_provider,
        llm_model=saved["llm_model"] or settings.llm_model,
        llm_base_url=saved["llm_base_url"] or settings.llm_base_url,
        llm_api_key_set=saved["llm_api_key_set"] or bool(settings.llm_api_key),
        embedding_provider=saved["embedding_provider"] or settings.embedding_provider,
        embedding_model=saved["embedding_model"] or settings.embedding_model,
        embedding_api_key_set=saved["embedding_api_key_set"] or bool(settings.embedding_api_key),
    )


@app.put("/v1/admin/provider-settings/llm", response_model=ProviderSettingsResponse)
def update_llm_provider(request: UpdateLlmProviderRequest, _auth: bool = Depends(verify_admin_key)):
    """
    Admin-only: sets the LLM provider/model/base URL, and optionally a new
    API key (omit or leave blank to keep the currently configured key).
    Applies to the very next chat request — no restart needed.
    """
    db.update_llm_provider_settings(
        provider=request.provider, model=request.model,
        base_url=request.base_url, api_key=request.api_key,
    )
    return get_provider_settings(_auth=True)


@app.put("/v1/admin/provider-settings/embedding", response_model=ProviderSettingsResponse)
def update_embedding_provider(request: UpdateEmbeddingProviderRequest, _auth: bool = Depends(verify_admin_key)):
    """
    Admin-only: sets the embedding provider/model, and optionally a new
    API key (omit or leave blank to keep the currently configured key).
    Note: changing the embedding model does NOT re-embed existing
    documents — re-upload/re-sync sources if you want them on the new model.
    """
    db.update_embedding_provider_settings(
        provider=request.provider, model=request.model, api_key=request.api_key,
    )
    return get_provider_settings(_auth=True)


@app.post("/v1/chat", response_model=ChatResponse)
def chat(request: ChatRequest, _auth: bool = Depends(rate_limited_chat)):
    """The single endpoint every frontend (default widget or custom UI) calls."""
    result = answer_question(request.question)
    return ChatResponse(**result)


@app.post("/v1/chat/stream")
def chat_stream(request: ChatRequest, _auth: bool = Depends(rate_limited_chat)):
    """
    Server-Sent Events version of /v1/chat — streams the answer as it's
    generated instead of waiting for the full response. Each event's
    `data` field is a JSON object:
      {"type": "chunk", "text": "..."}  — one piece of the answer
      {"type": "done", "sources": [...]} — sent once, at the end
      {"type": "error", "detail": "..."} — sent if generation fails mid-stream
    """
    def event_generator():
        try:
            for event in answer_question_stream(request.question):
                yield f"data: {json.dumps(event)}\n\n"
        except (LLMProviderError, IngestionError) as e:
            yield f"data: {json.dumps({'type': 'error', 'detail': e.message})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'detail': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/v1/ingest/file", response_model=IngestResponse)
def ingest_file(file: UploadFile = File(...), _auth: bool = Depends(verify_admin_key)):
    """Admin-only: upload a PDF/DOCX/CSV/TXT/MD file into the knowledge base."""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
    except Exception as e:
        raise IngestionError(f"Failed to read uploaded file: {e}")

    try:
        chunks = load_and_chunk_file(tmp_path)
        # re-tag chunks with the original filename, not the temp path
        for c in chunks:
            c["source"] = file.filename
        added = store_manager.upsert_chunks(chunks)
    finally:
        os.remove(tmp_path)

    return IngestResponse(source=file.filename, chunks_added=added)


@app.post("/v1/ingest/url", response_model=IngestResponse)
def ingest_url(request: IngestUrlRequest, _auth: bool = Depends(verify_admin_key)):
    """Admin-only: scrape a URL (company FAQ page, docs page, etc.)."""
    chunks = load_and_chunk_url(request.url)
    added = store_manager.upsert_chunks(chunks)
    return IngestResponse(source=request.url, chunks_added=added)


@app.post("/v1/sync/{source_name}", response_model=IngestResponse)
def resync_url(source_name: str, _auth: bool = Depends(verify_admin_key)):
    """
    Re-fetches a previously ingested URL and replaces its chunks.
    This is the auto-sync feature: call this after company data changes,
    only the affected source gets re-embedded, not the whole knowledge base.
    """
    chunks = load_and_chunk_url(source_name)
    added = store_manager.upsert_chunks(chunks)
    return IngestResponse(source=source_name, chunks_added=added)


@app.get("/v1/sources", response_model=SourceListResponse)
def list_sources(_auth: bool = Depends(verify_admin_key)):
    """Admin-only: see what's currently in the knowledge base."""
    stats = store_manager.stats()
    return SourceListResponse(
        sources=store_manager.list_sources(),
        total_chunks=stats["total_chunks"],
    )


@app.delete("/v1/sources")
def delete_source(request: DeleteSourceRequest, _auth: bool = Depends(verify_admin_key)):
    """Admin-only: remove a document/URL and its chunks from the knowledge base."""
    store_manager.delete_by_source(request.source)
    return {"deleted": request.source}
