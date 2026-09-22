"""
Custom exceptions for errors that should reach the client as clean,
specific HTTP responses instead of a raw 500 + Python traceback.
"""


class LLMProviderError(Exception):
    """
    Raised when the LLM or embedding provider call fails — bad/missing
    API key, rate limit, provider outage, network issue, etc. Carries a
    user-facing message and a suggested HTTP status code.
    """
    def __init__(self, message: str, status_code: int = 502):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class IngestionError(Exception):
    """Raised when a document/URL can't be parsed or fetched (bad file, dead link, etc)."""
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)
