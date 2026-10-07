"""Explicit completeness for sources that can return a bounded partial crawl."""
from collections.abc import Iterator
from dataclasses import dataclass
from contextlib import contextmanager
from contextvars import ContextVar
from time import monotonic

from job_discovery.models import Posting


@dataclass
class SourceStatus:
    complete: bool = True
    fetch_details: bool = True
    failed: bool = False


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
            budget = _budget.get()
            if budget is not None and monotonic() >= budget[0]:
                raise SourceBudgetExceeded('source time budget exhausted; incomplete')
            return next(self.postings)
        except StopIteration:
            self.exhausted = True
            raise
        except Exception:
            self.status.complete = False
            self.status.failed = True
            raise


def validate_ids(items: list, key: str) -> None:
    """An unreadable or duplicate source ID makes absence unsafe to interpret."""
    ids = set()
    for item in items:
        value = item.get(key) if isinstance(item, dict) else None
        if value is None or str(value).strip() == "" or str(value) in ids:
            raise ValueError(f"source listing has missing or duplicate {key}")
        ids.add(str(value))


# A board budget is scoped to this worker context; ordinary legacy calls retain
# their retry policy. Checks run before every page, including pages with no new
# identities (duplicate/facet walks cannot escape the request ceiling).
class SourceBudgetExceeded(ValueError):
    pass


_budget = ContextVar('source_budget', default=None)


@contextmanager
def source_budget(seconds, requests, pulse=None):
    token = _budget.set([monotonic()+seconds,requests,pulse])
    try:
        yield
    finally:
        _budget.reset(token)


def _request(method, url, **kwargs):
    from job_discovery import http
    budget = _budget.get()
    if budget is not None:
        if budget[1] <= 0 or monotonic() >= budget[0]:
            raise SourceBudgetExceeded('source request/time budget exhausted; incomplete')
        budget[1] -= 1
        if budget[2]:
            budget[2]()
        kwargs.update(retries=0,timeout=min(20,max(0.001,budget[0]-monotonic())))
    return getattr(http, method)(url, **kwargs)


def get_json(url, **kwargs):
    return _request('get_json',url,**kwargs)


def post_json(url, **kwargs):
    return _request('post_json',url,**kwargs)
