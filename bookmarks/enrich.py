"""
Claude Haiku enrichment.

For each bookmark, generates:
  - summary: 2-sentence description of what the resource is and why it's useful
  - tags: 5-7 descriptive tags (topic, technology, purpose, domain)

Processes bookmarks in batches. On any failure the bookmark is returned
with empty summary/tags so the pipeline continues.
"""

import json
import logging

import anthropic

logger = logging.getLogger(__name__)

_SYSTEM = (
    "You are a librarian building a searchable knowledge base of web bookmarks. "
    "For each bookmark you receive, produce a concise summary and relevant tags "
    "that will make it easy to find via natural-language search queries."
)

_USER_TMPL = """\
Bookmark:
Title: {title}
URL: {url}
Folder: {folder}
Description: {description}

Write a 2-sentence summary of what this resource is and why someone would find it valuable.
Then list 5-7 short tags (topic, technology, domain, purpose, format).

Respond with valid JSON only, no markdown fences:
{{"summary": "...", "tags": ["tag1", "tag2", ...]}}"""


def enrich_batch(
    bookmarks: list[dict],
    model: str = "claude-haiku-4-5-20251001",
    skip_domains: list[str] = None,
) -> list[dict]:
    """
    Enrich a list of bookmarks with Claude-generated summary and tags.
    Returns the same list with 'summary' and 'tags' fields added.
    """
    client = anthropic.Anthropic()
    skip_domains = skip_domains or []

    for bm in bookmarks:
        domain = bm.get("domain", "")
        if any(s in domain for s in skip_domains):
            bm.setdefault("summary", "")
            bm.setdefault("tags", [])
            continue

        bm["summary"], bm["tags"] = _enrich_one(client, bm, model)

    return bookmarks


def _enrich_one(client: anthropic.Anthropic, bm: dict, model: str) -> tuple[str, list]:
    prompt = _USER_TMPL.format(
        title=bm.get("title", ""),
        url=bm.get("url", ""),
        folder=bm.get("folder", ""),
        description=bm.get("description", ""),
    )
    try:
        msg = client.messages.create(
            model=model,
            max_tokens=256,
            system=_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        text = msg.content[0].text.strip()
        data = json.loads(text)
        summary = str(data.get("summary", "")).strip()
        tags = [str(t).strip().lower() for t in data.get("tags", []) if t]
        return summary, tags
    except Exception as exc:
        logger.warning("Enrichment failed for %s: %s", bm.get("url", ""), exc)
        return "", []
