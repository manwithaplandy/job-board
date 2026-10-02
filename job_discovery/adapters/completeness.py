"""Explicit completeness for sources that can return a bounded partial crawl."""
from collections.abc import Iterator
from dataclasses import dataclass

from job_discovery.models import Posting


@dataclass
class SourceStatus:
    complete: bool = True
    fetch_details: bool = True


class SourceResult(Iterator[Posting]):
    """Keep lazy ingestion while exposing completeness only after exhaustion."""

    def __init__(self, postings: Iterator[Posting], status: SourceStatus):
        self.postings = postings
        self.status = status
        self.exhausted = False

    @property
    def complete(self) -> bool:
        return self.exhausted and self.status.complete

    def __next__(self) -> Posting:
        try:
            return next(self.postings)
        except StopIteration:
            self.exhausted = True
            raise


def validate_ids(items: list, key: str) -> None:
    """An unreadable or duplicate source ID makes absence unsafe to interpret."""
    ids = set()
    for item in items:
        value = item.get(key) if isinstance(item, dict) else None
        if value is None or str(value).strip() == "" or str(value) in ids:
            raise ValueError(f"source listing has missing or duplicate {key}")
        ids.add(str(value))
