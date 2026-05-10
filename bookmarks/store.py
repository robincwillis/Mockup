"""
Voyage embedding + Pinecone upsert with URL-hash deduplication.

Deduplication strategy:
  - Each bookmark's vector ID is sha256(url).
  - Before embedding/upserting a batch, we call index.fetch(ids=...) to
    find which IDs already exist in Pinecone and skip them.
"""

import hashlib
import logging
from datetime import datetime, timezone
from urllib.parse import urlparse

import voyageai
from pinecone import Pinecone

logger = logging.getLogger(__name__)


def url_hash(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()


def build_embed_text(bm: dict) -> str:
    parts = [
        f"Title: {bm.get('title', '')}",
        f"URL: {bm.get('url', '')}",
        f"Domain: {bm.get('domain', '')}",
    ]
    if bm.get("folder"):
        parts.append(f"Folder: {bm['folder']}")
    if bm.get("description"):
        parts.append(f"Description: {bm['description']}")
    if bm.get("summary"):
        parts.append(f"Summary: {bm['summary']}")
    if bm.get("tags"):
        parts.append(f"Tags: {', '.join(bm['tags'])}")
    return "\n".join(parts)


def build_metadata(bm: dict) -> dict:
    """Build the Pinecone metadata payload. All values must be str, int, float, or list[str]."""
    return {
        "url": bm.get("url", ""),
        "title": bm.get("title", ""),
        "domain": bm.get("domain", ""),
        "folder": bm.get("folder", ""),
        "added_date": bm.get("added_date", ""),
        "description": bm.get("description", ""),
        "summary": bm.get("summary", ""),
        "tags": bm.get("tags", []),
        "url_hash": url_hash(bm.get("url", "")),
        "processed_at": datetime.now(tz=timezone.utc).isoformat(timespec="seconds"),
    }


class BookmarkStore:
    def __init__(
        self,
        pinecone_api_key: str,
        voyage_api_key: str,
        index_name: str = "bookmarks",
        namespace: str = "",
        voyage_model: str = "voyage-3",
        voyage_batch_size: int = 128,
        pinecone_batch_size: int = 100,
    ):
        self._pc = Pinecone(api_key=pinecone_api_key)
        self._index = self._pc.Index(index_name)
        self._namespace = namespace
        self._vc = voyageai.Client(api_key=voyage_api_key)
        self._voyage_model = voyage_model
        self._voyage_batch = voyage_batch_size
        self._pc_batch = pinecone_batch_size

    def filter_new(self, bookmarks: list[dict]) -> list[dict]:
        """
        Return only bookmarks whose URL hash is not already in Pinecone.
        Checks in batches to minimise API calls.
        """
        if not bookmarks:
            return []

        ids = [url_hash(bm["url"]) for bm in bookmarks]
        existing = set()

        for i in range(0, len(ids), self._pc_batch):
            batch_ids = ids[i : i + self._pc_batch]
            try:
                result = self._index.fetch(ids=batch_ids, namespace=self._namespace)
                existing.update(result.vectors.keys())
            except Exception as exc:
                logger.warning("Pinecone fetch failed: %s", exc)

        new = [bm for bm in bookmarks if url_hash(bm["url"]) not in existing]
        skipped = len(bookmarks) - len(new)
        if skipped:
            logger.info("Skipping %d already-indexed bookmarks.", skipped)
        return new

    def upsert(self, bookmarks: list[dict], dry_run: bool = False) -> int:
        """
        Embed and upsert bookmarks. Returns the count of vectors upserted.
        """
        if not bookmarks:
            return 0

        texts = [build_embed_text(bm) for bm in bookmarks]
        vectors_upserted = 0

        for i in range(0, len(texts), self._voyage_batch):
            batch_texts = texts[i : i + self._voyage_batch]
            batch_bms = bookmarks[i : i + self._voyage_batch]

            try:
                result = self._vc.embed(
                    batch_texts,
                    model=self._voyage_model,
                    input_type="document",
                )
                embeddings = result.embeddings
            except Exception as exc:
                logger.error("Voyage embedding failed for batch %d: %s", i, exc)
                continue

            records = [
                {
                    "id": url_hash(bm["url"]),
                    "values": emb,
                    "metadata": build_metadata(bm),
                }
                for bm, emb in zip(batch_bms, embeddings)
            ]

            if dry_run:
                logger.info("[dry-run] Would upsert %d vectors.", len(records))
                vectors_upserted += len(records)
                continue

            try:
                self._index.upsert(vectors=records, namespace=self._namespace)
                vectors_upserted += len(records)
            except Exception as exc:
                logger.error("Pinecone upsert failed for batch %d: %s", i, exc)

        return vectors_upserted


def add_derived_fields(bookmarks: list[dict]) -> list[dict]:
    """Add 'domain' field derived from URL."""
    for bm in bookmarks:
        try:
            bm["domain"] = urlparse(bm["url"]).netloc
        except Exception:
            bm["domain"] = ""
    return bookmarks
