"""Version 1 canonical UTF-8 JSONL and reproducible gzip, without external I/O."""

import gzip
import io
import json

MAX_EXPANDED = 8 * 1024**2
MAX_COMPRESSED = 16 * 1024**2
MAX_MANIFEST = 1024**2


def canonical_json(value) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def encode_events(events) -> tuple[bytes, bytes]:
    chunks = []
    total = 0
    for event in events:
        chunk = canonical_json(event) + b"\n"
        total += len(chunk)
        if len(chunks) >= 2000 or total > MAX_EXPANDED:
            raise ValueError("batch exceeds 2000 events or 8MiB expanded")
        chunks.append(chunk)
    data = b"".join(chunks)
    output = io.BytesIO()
    with gzip.GzipFile(
        filename="", fileobj=output, mode="wb", mtime=0, compresslevel=9
    ) as stream:
        stream.write(data)
    return data, output.getvalue()
