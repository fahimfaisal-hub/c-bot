"""
Ties retrieval + prompt building + generation together. This is the one
function the API layer calls for every chat request. Also logs the full
final prompt, answer, and sources for every question — this is what
powers the admin panel's Prompt Log and Unanswered Questions views.
"""
from core_engine.vectorstore import store_manager
from core_engine.rag.prompt_templates import build_rag_prompt
from core_engine.rag.llm_client import generate_answer, generate_answer_stream
from core_engine.storage import db


def _messages_to_readable_text(messages: list) -> str:
    """Renders the chat-format message list as one readable string for logging."""
    return "\n\n".join(f"[{m['role'].upper()}]\n{m['content']}" for m in messages)


def answer_question(question: str) -> dict:
    context_chunks = store_manager.query(question)
    messages = build_rag_prompt(question, context_chunks)
    answer = generate_answer(messages)
    sources = sorted({c["source"] for c in context_chunks})

    db.log_chat(
        question=question,
        final_prompt=_messages_to_readable_text(messages),
        answer=answer,
        sources=sources,
    )

    return {"answer": answer, "sources": sources}


def answer_question_stream(question: str):
    """
    Same as answer_question(), but yields text chunks as they're generated.
    The full answer is still logged (with the same unanswered-detection
    logic) once streaming completes, so the Prompt Log stays complete.
    Yields the sources list last, as a special final item.
    """
    context_chunks = store_manager.query(question)
    messages = build_rag_prompt(question, context_chunks)
    sources = sorted({c["source"] for c in context_chunks})

    full_answer_parts = []
    for chunk in generate_answer_stream(messages):
        full_answer_parts.append(chunk)
        yield {"type": "chunk", "text": chunk}

    full_answer = "".join(full_answer_parts)
    db.log_chat(
        question=question,
        final_prompt=_messages_to_readable_text(messages),
        answer=full_answer,
        sources=sources,
    )

    yield {"type": "done", "sources": sources}
