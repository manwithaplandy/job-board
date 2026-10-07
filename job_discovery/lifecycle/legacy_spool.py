"""Bounded local feed spool: legacy HTTP completes before any gated mutation.

This is not enumeration/reconciliation history. A failed, partial or overflowing
feed is discarded without authorizing closure. Only synthetic/local data is used
in tests; these temporary files contain public employer records, never user data.
"""

from contextlib import contextmanager
from dataclasses import asdict
import json
import tempfile
import time

from job_discovery.models import Posting

MAX_ROWS = 100_000
MAX_BYTES = 64 * 1024**2
MAX_SECONDS = 120


@contextmanager
def spool_feed(postings):
    started = time.monotonic()
    seen = set()
    size = count = 0
    with tempfile.TemporaryFile(mode="w+t", encoding="utf-8") as spool:
        try:
            for posting in postings:
                encoded = json.dumps(asdict(posting), separators=(",", ":")) + "\n"
                size += len(encoded.encode("utf-8"))
                count += 1
                if (
                    count > MAX_ROWS
                    or size > MAX_BYTES
                    or time.monotonic() - started > MAX_SECONDS
                ):
                    raise ValueError(
                        "legacy feed spool budget exceeded; enumeration incomplete"
                    )
                if posting.external_id:
                    seen.add(posting.external_id)
                spool.write(encoded)
            if not getattr(postings, "complete", True):
                raise ValueError(
                    "source enumeration incomplete; refusing closure reconciliation"
                )
            spool.seek(0)
            yield (Posting(**json.loads(line)) for line in spool), seen
        finally:
            close = getattr(postings, "close", None)
            if close:
                close()


@contextmanager
def spool_questions(
    conn, company_id, token, get_json, parse, missing_query, extra_ids=(), log=None
):
    from job_discovery.adapters.greenhouse import parse_greenhouse_questions

    parse = parse or parse_greenhouse_questions
    ids = set(missing_query(conn, company_id)) | set(extra_ids)
    conn.commit()  # Close the read transaction BEFORE the first HTTP call.
    if len(ids) > MAX_ROWS:
        raise ValueError("legacy question spool row budget exceeded")
    started = time.monotonic()
    size = 0
    with tempfile.TemporaryFile(mode="w+t", encoding="utf-8") as spool:
        for external_id in sorted(ids):
            if time.monotonic() - started > MAX_SECONDS:
                raise ValueError("legacy question spool deadline exceeded")
            try:
                data = parse(
                    get_json(
                        f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs/{external_id}?questions=true"
                    )
                )
            except Exception as error:
                if log:
                    log.warning(
                        "greenhouse question fetch failed for %s:%s (%s)",
                        token,
                        external_id,
                        type(error).__name__,
                    )
                continue
            if data and data["questions"]:
                encoded = json.dumps([external_id, data], separators=(",", ":")) + "\n"
                size += len(encoded.encode("utf-8"))
                if size > MAX_BYTES:
                    raise ValueError("legacy question spool byte budget exceeded")
                spool.write(encoded)
        spool.seek(0)
        yield (json.loads(line) for line in spool)
