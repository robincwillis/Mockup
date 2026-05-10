"""
HTTP metadata fetcher.

For each bookmark URL, fetches the page and extracts:
  - title (from <title> or og:title)
  - description (from <meta name="description"> or og:description)
  - og_type (from og:type, e.g. "website", "article")

Failures are swallowed — callers receive an empty dict and continue.
"""

import time
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

_SKIP_SCHEMES = {"javascript", "data", "mailto", "file"}


def build_session(max_retries: int = 2) -> requests.Session:
    session = requests.Session()
    retry = Retry(
        total=max_retries,
        backoff_factor=0.5,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    session.headers.update(_HEADERS)
    return session


def fetch_metadata(
    url: str,
    session: requests.Session,
    timeout: int = 10,
    delay: float = 0.5,
) -> dict:
    """
    Fetch page metadata for a URL.
    Returns a dict with keys: title, description, og_type (all str, may be empty).
    Never raises — returns {} on any error.
    """
    scheme = urlparse(url).scheme.lower()
    if scheme in _SKIP_SCHEMES or not scheme:
        return {}

    try:
        time.sleep(delay)
        resp = session.get(url, timeout=timeout, allow_redirects=True)
        resp.raise_for_status()

        # Only parse HTML responses
        ct = resp.headers.get("Content-Type", "")
        if "html" not in ct:
            return {}

        return _extract(resp.text)
    except Exception:
        return {}


def _extract(html: str) -> dict:
    soup = BeautifulSoup(html, "lxml")

    def og(prop: str) -> str:
        tag = soup.find("meta", property=f"og:{prop}")
        return (tag.get("content") or "").strip() if tag else ""

    def meta(name: str) -> str:
        tag = soup.find("meta", attrs={"name": name})
        return (tag.get("content") or "").strip() if tag else ""

    title = og("title") or (soup.title.string.strip() if soup.title else "")
    description = og("description") or meta("description")
    og_type = og("type")

    return {
        "title": title,
        "description": description,
        "og_type": og_type,
    }
