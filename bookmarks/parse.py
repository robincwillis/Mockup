"""
Bookmark file parsers.

Supported formats:
  - Netscape Bookmark File (HTML) — exported by Chrome, Firefox, Safari
  - JSON flat list: [{"url": ..., "title": ..., ...}]
  - Chrome internal JSON: {"roots": {"bookmark_bar": {"children": [...]}}}
"""

import json
from datetime import datetime, timezone
from pathlib import Path

from bs4 import BeautifulSoup


def parse(path: str) -> list[dict]:
    """Parse a bookmark export file. Returns a list of bookmark dicts."""
    p = Path(path).expanduser()
    text = p.read_text(encoding="utf-8", errors="replace")

    if p.suffix.lower() == ".json":
        return _parse_json(text)
    return _parse_html(text)


# ---------------------------------------------------------------------------
# HTML (Netscape Bookmark File Format)
# ---------------------------------------------------------------------------

def _parse_html(text: str) -> list[dict]:
    soup = BeautifulSoup(text, "lxml")
    bookmarks = []
    _walk_dl(soup.find("dl"), folder="", out=bookmarks)
    return bookmarks


def _walk_dl(dl, folder: str, out: list):
    """Recursively walk <DL> elements to build folder-aware bookmark list."""
    if dl is None:
        return
    current_folder = folder
    for child in dl.children:
        if not hasattr(child, "name"):
            continue
        if child.name == "dt":
            h3 = child.find("h3")
            a = child.find("a")
            if h3:
                # This DT contains a folder header — descend into the next DL
                subfolder = "/".join(filter(None, [current_folder, h3.get_text(strip=True)]))
                sibling_dl = child.find_next_sibling("dl")
                if sibling_dl is None:
                    # Some exports nest the DL inside the DT
                    sibling_dl = child.find("dl")
                _walk_dl(sibling_dl, folder=subfolder, out=out)
            elif a and a.get("href"):
                out.append(_make_bookmark(a, folder=current_folder))


def _make_bookmark(a_tag, folder: str) -> dict:
    url = a_tag.get("href", "").strip()
    title = a_tag.get_text(strip=True) or url
    add_date_raw = a_tag.get("add_date") or a_tag.get("last_modified", "")
    added_date = _unix_to_iso(add_date_raw)
    return {
        "url": url,
        "title": title,
        "folder": folder,
        "added_date": added_date,
    }


def _unix_to_iso(value: str) -> str:
    try:
        ts = int(value)
        return datetime.fromtimestamp(ts, tz=timezone.utc).date().isoformat()
    except (ValueError, TypeError, OSError):
        return ""


# ---------------------------------------------------------------------------
# JSON
# ---------------------------------------------------------------------------

def _parse_json(text: str) -> list[dict]:
    data = json.loads(text)

    # Chrome internal format: {"roots": {"bookmark_bar": {"children": [...]}}}
    if isinstance(data, dict) and "roots" in data:
        bookmarks = []
        for root_name, root in data["roots"].items():
            _walk_chrome_node(root, folder=root_name, out=bookmarks)
        return bookmarks

    # Flat list: [{"url": ..., "title": ...}, ...]
    if isinstance(data, list):
        return [_normalise_json_item(item) for item in data if isinstance(item, dict) and item.get("url")]

    raise ValueError("Unrecognised JSON bookmark format")


def _walk_chrome_node(node: dict, folder: str, out: list):
    kind = node.get("type")
    if kind == "url":
        url = node.get("url", "").strip()
        if url:
            out.append({
                "url": url,
                "title": node.get("name", url),
                "folder": folder,
                "added_date": _chrome_timestamp_to_iso(node.get("date_added", "")),
            })
    elif kind == "folder":
        subfolder = "/".join(filter(None, [folder, node.get("name", "")]))
        for child in node.get("children", []):
            _walk_chrome_node(child, folder=subfolder, out=out)


def _chrome_timestamp_to_iso(value: str) -> str:
    # Chrome stores timestamps as microseconds since 1601-01-01
    try:
        ts_us = int(value)
        # Convert to Unix epoch (seconds)
        unix_s = (ts_us / 1_000_000) - 11644473600
        return datetime.fromtimestamp(unix_s, tz=timezone.utc).date().isoformat()
    except (ValueError, TypeError, OSError):
        return ""


def _normalise_json_item(item: dict) -> dict:
    return {
        "url": item.get("url", "").strip(),
        "title": item.get("title") or item.get("name") or item.get("url", ""),
        "folder": item.get("folder") or item.get("tags") or "",
        "added_date": item.get("added_date") or item.get("date") or "",
    }
