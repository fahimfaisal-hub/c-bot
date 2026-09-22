"""
Fetches a web page and extracts readable text (strips nav/scripts/styles).
Used when a company wants to feed website content (FAQ pages, docs, etc.)
directly into the knowledge base instead of uploading files.
"""
import requests
from bs4 import BeautifulSoup
from core_engine.errors import IngestionError


def scrape_url(url: str, timeout: int = 15) -> str:
    """Fetches a URL and returns cleaned, readable text content."""
    try:
        response = requests.get(url, timeout=timeout, headers={
            "User-Agent": "CompanyBotFramework/1.0 (+https://github.com/)"
        })
        response.raise_for_status()
    except requests.exceptions.Timeout:
        raise IngestionError(f"Timed out fetching {url}. The site may be slow or unreachable.")
    except requests.exceptions.ConnectionError:
        raise IngestionError(f"Could not connect to {url}. Check the URL is correct and reachable.")
    except requests.exceptions.HTTPError as e:
        raise IngestionError(f"{url} returned an error: {e.response.status_code} {e.response.reason}")
    except requests.exceptions.RequestException as e:
        raise IngestionError(f"Failed to fetch {url}: {e}")

    soup = BeautifulSoup(response.text, "html.parser")

    # strip non-content tags
    for tag in soup(["script", "style", "nav", "footer", "header", "noscript"]):
        tag.decompose()

    text = soup.get_text(separator=" ")
    cleaned = " ".join(text.split())

    if not cleaned:
        raise IngestionError(f"No readable text content was found at {url}.")

    return cleaned
