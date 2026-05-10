#!/usr/bin/env python3
"""
Bookmark ingestion pipeline.

Parses a browser bookmark export, fetches page metadata, enriches with
Claude, and upserts into Pinecone via Voyage embeddings.

Usage:
  ingest.py --input ~/bookmarks.html
  ingest.py --input ~/bookmarks.json --dry-run
  ingest.py --input ~/bookmarks.html --limit 20
  ingest.py --input ~/bookmarks.html --since 2025-01-01
  ingest.py --input ~/bookmarks.html --no-enrich
"""

import argparse
import logging
import os
import sys
from datetime import date, timezone
from pathlib import Path

from dotenv import load_dotenv
from tqdm import tqdm

# Make sure the package root is importable when run as a script
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bookmarks import enrich, fetch, parse
from bookmarks.store import BookmarkStore, add_derived_fields

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

def _require_env(name: str) -> str:
    val = os.environ.get(name, "").strip()
    if not val:
        sys.exit(f"Missing required environment variable: {name}")
    return val


# ---------------------------------------------------------------------------
# Filtering helpers
# ---------------------------------------------------------------------------

def _filter_since(bookmarks: list[dict], since: date) -> list[dict]:
    kept = []
    for bm in bookmarks:
        added = bm.get("added_date", "")
        if not added:
            kept.append(bm)
            continue
        try:
            if date.fromisoformat(added) >= since:
                kept.append(bm)
        except ValueError:
            kept.append(bm)
    return kept


def _filter_valid(bookmarks: list[dict]) -> list[dict]:
    return [
        bm for bm in bookmarks
        if bm.get("url", "").startswith(("http://", "https://"))
    ]


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

def run(
    input_path: str,
    dry_run: bool = False,
    limit: int = None,
    since: date = None,
    no_enrich: bool = False,
    fetch_delay: float = 0.5,
    fetch_timeout: int = 10,
    fetch_retries: int = 2,
    enrich_model: str = "claude-haiku-4-5-20251001",
    enrich_skip_domains: list[str] = None,
    pinecone_index: str = "bookmarks",
    pinecone_namespace: str = "",
    voyage_model: str = "voyage-3",
):
    # ── 1. Parse ──────────────────────────────────────────────────────────
    logger.info("Parsing %s", input_path)
    bookmarks = parse.parse(input_path)
    logger.info("Found %d bookmarks", len(bookmarks))

    bookmarks = _filter_valid(bookmarks)
    logger.info("%d bookmarks with valid URLs", len(bookmarks))

    if since:
        bookmarks = _filter_since(bookmarks, since)
        logger.info("%d bookmarks since %s", len(bookmarks), since)

    if limit:
        bookmarks = bookmarks[:limit]
        logger.info("Limited to %d bookmarks", len(bookmarks))

    if not bookmarks:
        logger.info("Nothing to process.")
        return

    # Add domain derived from URL
    bookmarks = add_derived_fields(bookmarks)

    if dry_run:
        logger.info("[dry-run] Parsed bookmarks:")
        for bm in bookmarks:
            print(f"  {bm['folder'] or '/':<30}  {bm['title'][:50]:<50}  {bm['url']}")
        return

    # ── 2. Deduplication check ────────────────────────────────────────────
    logger.info("Checking Pinecone for existing bookmarks...")
    store = BookmarkStore(
        pinecone_api_key=_require_env("PINECONE_API_KEY"),
        voyage_api_key=_require_env("VOYAGE_API_KEY"),
        index_name=pinecone_index,
        namespace=pinecone_namespace,
        voyage_model=voyage_model,
    )
    bookmarks = store.filter_new(bookmarks)
    logger.info("%d new bookmarks to process", len(bookmarks))

    if not bookmarks:
        logger.info("All bookmarks already indexed. Done.")
        return

    # ── 3. Fetch page metadata ────────────────────────────────────────────
    logger.info("Fetching page metadata...")
    session = fetch.build_session(max_retries=fetch_retries)
    for bm in tqdm(bookmarks, desc="Fetching", unit="url"):
        meta = fetch.fetch_metadata(
            bm["url"], session=session, timeout=fetch_timeout, delay=fetch_delay
        )
        # Prefer scraped title/description over export title only if richer
        if meta.get("title") and not bm.get("title"):
            bm["title"] = meta["title"]
        bm["description"] = meta.get("description", "")
        bm["og_type"] = meta.get("og_type", "")

    # ── 4. Claude enrichment ──────────────────────────────────────────────
    if not no_enrich:
        logger.info("Enriching with Claude (%s)...", enrich_model)
        for bm in tqdm(bookmarks, desc="Enriching", unit="bookmark"):
            enrich.enrich_batch(
                [bm],
                model=enrich_model,
                skip_domains=enrich_skip_domains or [],
            )
    else:
        for bm in bookmarks:
            bm.setdefault("summary", "")
            bm.setdefault("tags", [])

    # ── 5. Embed + upsert ─────────────────────────────────────────────────
    logger.info("Embedding and upserting to Pinecone...")
    upserted = store.upsert(bookmarks, dry_run=dry_run)
    logger.info("Done. %d vectors upserted.", upserted)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _parse_since(value: str) -> date:
    if value.lower() == "yesterday":
        from datetime import timedelta
        return date.today() - timedelta(days=1)
    return date.fromisoformat(value)


def main():
    ap = argparse.ArgumentParser(
        description="Ingest browser bookmarks into Pinecone via Voyage embeddings."
    )
    ap.add_argument("--input", required=True, help="Path to bookmark export (.html or .json)")
    ap.add_argument("--dry-run", action="store_true", help="Parse and print; no API calls or writes")
    ap.add_argument("--limit", type=int, default=None, help="Process at most N bookmarks (for testing)")
    ap.add_argument("--since", default=None, help="Only process bookmarks added on or after this date (YYYY-MM-DD or 'yesterday')")
    ap.add_argument("--no-enrich", action="store_true", help="Skip Claude enrichment; use scraped metadata only")
    ap.add_argument("--index", default=os.environ.get("PINECONE_INDEX", "bookmarks"), help="Pinecone index name")
    ap.add_argument("--namespace", default="", help="Pinecone namespace")
    ap.add_argument("--voyage-model", default="voyage-3", help="Voyage embedding model")
    ap.add_argument("--enrich-model", default="claude-haiku-4-5-20251001", help="Claude model for enrichment")
    ap.add_argument("--fetch-delay", type=float, default=0.5, help="Seconds between HTTP requests")
    args = ap.parse_args()

    since = _parse_since(args.since) if args.since else None

    run(
        input_path=args.input,
        dry_run=args.dry_run,
        limit=args.limit,
        since=since,
        no_enrich=args.no_enrich,
        fetch_delay=args.fetch_delay,
        pinecone_index=args.index,
        pinecone_namespace=args.namespace,
        voyage_model=args.voyage_model,
        enrich_model=args.enrich_model,
    )


if __name__ == "__main__":
    main()
