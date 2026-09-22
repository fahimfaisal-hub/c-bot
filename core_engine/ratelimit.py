"""
Lightweight in-memory rate limiter for /v1/chat and /v1/chat/stream —
these are the only endpoints reachable with the public chat key, which
is expected to be visible in a website's page source. Without a limit,
a leaked (or just copy-pasted) key lets anyone hammer the endpoint and
run up LLM costs.

In-memory (a plain dict), not Redis — appropriate for this self-hosted,
single-process deployment. A multi-worker/multi-instance production
setup would need a shared store instead.
"""
import time
from collections import defaultdict, deque
from core_engine.config import settings
from core_engine.errors import LLMProviderError

# {client_key: deque of request timestamps within the current window}
_request_log = defaultdict(deque)

_WINDOW_SECONDS = 60


def check_rate_limit(client_key: str) -> None:
    """
    Raises LLMProviderError (429) if client_key has exceeded
    RATE_LIMIT_PER_MINUTE requests in the last 60 seconds. Call this at
    the top of any endpoint that should be rate-limited.
    """
    limit = settings.rate_limit_per_minute
    if limit <= 0:
        return  # 0 or negative disables rate limiting

    now = time.time()
    timestamps = _request_log[client_key]

    # drop timestamps outside the current window
    while timestamps and timestamps[0] < now - _WINDOW_SECONDS:
        timestamps.popleft()

    if len(timestamps) >= limit:
        raise LLMProviderError(
            f"Rate limit exceeded ({limit} requests/minute). Try again shortly.",
            status_code=429,
        )

    timestamps.append(now)
