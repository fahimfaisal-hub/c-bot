from pydantic import BaseModel, Field
from typing import List, Optional


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, description="The user's question")


class ChatResponse(BaseModel):
    answer: str
    sources: List[str]


class IngestUrlRequest(BaseModel):
    url: str


class IngestResponse(BaseModel):
    source: str
    chunks_added: int


class SourceListResponse(BaseModel):
    sources: List[str]
    total_chunks: int


class DeleteSourceRequest(BaseModel):
    source: str


class BotConfigResponse(BaseModel):
    bot_name: str
    system_prompt: str
    llm_provider: str
    llm_model: str


class UpdateSystemPromptRequest(BaseModel):
    system_prompt: str = Field(..., min_length=1)


class ChatLogEntry(BaseModel):
    id: int
    timestamp: str
    question: str
    final_prompt: str
    answer: str
    sources: List[str]
    is_unanswered: bool


class ChatLogListResponse(BaseModel):
    logs: List[ChatLogEntry]
    total_questions: int
    unanswered_questions: int


class AutomationSettingsResponse(BaseModel):
    log_retention_days: int
    last_log_cleanup_at: Optional[str]
    auto_sync_enabled: bool
    auto_sync_interval_hours: int
    last_auto_sync_at: Optional[str]


class UpdateLogRetentionRequest(BaseModel):
    retention_days: int = Field(..., ge=0, description="0 disables auto-clear")


class UpdateAutoSyncRequest(BaseModel):
    enabled: bool
    interval_hours: int = Field(..., ge=1, description="How often to re-sync all URL sources")


class ChatPublicKeyResponse(BaseModel):
    chat_public_key: str


class AllowedDomainsResponse(BaseModel):
    allowed_domains: List[str]


class UpdateAllowedDomainsRequest(BaseModel):
    allowed_domains: List[str]


class ProviderSettingsResponse(BaseModel):
    llm_provider: str
    llm_model: str
    llm_base_url: str
    llm_api_key_set: bool
    embedding_provider: str
    embedding_model: str
    embedding_api_key_set: bool


class UpdateLlmProviderRequest(BaseModel):
    provider: str = Field(..., description="openai | gemini | local")
    model: str = Field(..., min_length=1)
    base_url: str = Field("", description="Only used when provider is 'local' (Ollama, vLLM, OpenRouter, etc)")
    api_key: Optional[str] = Field(None, description="Leave blank/omit to keep the existing key")


class UpdateEmbeddingProviderRequest(BaseModel):
    provider: str = Field(..., description="openai | gemini | local")
    model: str = Field(..., min_length=1)
    api_key: Optional[str] = Field(None, description="Leave blank/omit to keep the existing key")
