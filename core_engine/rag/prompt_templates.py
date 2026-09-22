"""
Builds the final prompt sent to the LLM, combining retrieved context
with the company's system prompt and the user's question.
"""
from typing import List
from core_engine.config import settings
from core_engine.storage import db


def get_active_system_prompt() -> str:
    """
    Returns the system prompt currently in effect: the admin-panel
    override if one has been saved, otherwise the .env default.
    """
    return db.get_setting("system_prompt", default=settings.system_prompt)


def build_rag_prompt(question: str, context_chunks: List[dict]) -> list:
    """Returns a chat-format message list ready for the LLM client."""
    if context_chunks:
        context_text = "\n\n".join(
            f"[Source: {c['source']}]\n{c['text']}" for c in context_chunks
        )
    else:
        context_text = "(No relevant company information was found for this question.)"

    # No hardcoded behavior instructions here — the system prompt is the
    # single source of truth for how the bot should behave (tone, whether
    # it must stay strictly on-topic, etc). Baking extra instructions into
    # the user message would silently override a custom system prompt.
    user_message = (
        f"Context from company knowledge base:\n{context_text}\n\n"
        f"Question: {question}"
    )

    return [
        {"role": "system", "content": get_active_system_prompt()},
        {"role": "user", "content": user_message},
    ]
