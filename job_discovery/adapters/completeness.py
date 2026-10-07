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


def iter_identified_postings(items, parse_one, status, *, title_key, url_keys,
                             id_key="id", minimal_posting=None):
    """Keep trustworthy identities even when the same response is incomplete.

    Bad or repeated identities invalidate absence but do not erase other items.
    An identifiable item with malformed display fields remains a minimal positive;
    it cannot be admitted as a new Job until its required display fields exist.
    """
    seen = set()
    for item in items:
        external_id = item.get(id_key) if isinstance(item, dict) else None
        if (not isinstance(external_id, (str, int)) or isinstance(external_id, bool)
                or not str(external_id).strip()):
            status.complete = False
            continue
        external_id = str(external_id)
        if external_id in seen:
            status.complete = False
            continue
        seen.add(external_id)
        try:
            posting = parse_one(item)
            if not isinstance(posting.title, str) or not posting.title.strip():
                raise ValueError('listing title is missing')
            if not isinstance(posting.url, str) or not posting.url.strip():
                raise ValueError('listing URL is missing')
        except (KeyError, TypeError, AttributeError, ValueError, IndexError) as exc:
            status.complete = False
            title = item.get(title_key)
            url = next((item.get(key) for key in url_keys
                        if isinstance(item.get(key), str) and item[key].strip()), None)
            posting = minimal_posting(item, exc) if minimal_posting else None
            if posting is None:
                posting = Posting(external_id=external_id,
                                  title=title if isinstance(title, str) else None,
                                  url=url, raw=item)
            posting.metadata_complete = False
        yield posting
