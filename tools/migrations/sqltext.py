"""Minimal SQL text handling for migration checks.

This is not a parser. It splits a file into top-level statements while
respecting comments, quoted strings, quoted identifiers and dollar-quoted
bodies, and gives each statement in two forms:

* ``raw``  - comments removed, everything else kept (for reading values such
  as ``SET lock_timeout = '5s'``);
* ``code`` - comments removed and the contents of strings and dollar-quoted
  bodies blanked, so keywords inside a function body or a string literal can
  never match a rule.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

_DOLLAR_TAG = re.compile(r"\$([A-Za-z_][A-Za-z0-9_]*)?\$")


@dataclass(frozen=True)
class Statement:
    raw: str
    code: str


def split_statements(text: str) -> list[Statement]:
    """Split ``text`` into top-level statements (empty ones dropped)."""
    statements: list[Statement] = []
    raw: list[str] = []
    code: list[str] = []
    i, n = 0, len(text)

    def flush() -> None:
        r, c = "".join(raw).strip(), "".join(code).strip()
        if c:
            statements.append(Statement(raw=r, code=" ".join(c.split())))
        raw.clear()
        code.clear()

    while i < n:
        ch = text[i]
        nxt = text[i + 1] if i + 1 < n else ""
        if ch == "-" and nxt == "-":
            end = text.find("\n", i)
            i = n if end == -1 else end
            raw.append(" ")
            code.append(" ")
            continue
        if ch == "/" and nxt == "*":
            depth, j = 1, i + 2
            while j < n and depth:
                if text.startswith("/*", j):
                    depth, j = depth + 1, j + 2
                elif text.startswith("*/", j):
                    depth, j = depth - 1, j + 2
                else:
                    j += 1
            i = j
            raw.append(" ")
            code.append(" ")
            continue
        if ch == "'":
            escaped = i > 0 and text[i - 1] in "eE" and (i < 2 or not text[i - 2].isalnum())
            j = i + 1
            while j < n:
                if escaped and text[j] == "\\":
                    j += 2
                    continue
                if text[j] == "'":
                    if j + 1 < n and text[j + 1] == "'":
                        j += 2
                        continue
                    break
                j += 1
            raw.append(text[i : j + 1])
            code.append("''")
            i = j + 1
            continue
        if ch == '"':
            j = text.find('"', i + 1)
            while j != -1 and j + 1 < n and text[j + 1] == '"':
                j = text.find('"', j + 2)
            j = n - 1 if j == -1 else j
            raw.append(text[i : j + 1])
            code.append(text[i : j + 1])
            i = j + 1
            continue
        if ch == "$":
            m = _DOLLAR_TAG.match(text, i)
            if m and not (i > 0 and (text[i - 1].isalnum() or text[i - 1] == "_")):
                tag = m.group(0)
                end = text.find(tag, m.end())
                end = n if end == -1 else end
                raw.append(text[i : end + len(tag)])
                code.append(f"{tag} {tag}")
                i = end + len(tag)
                continue
        if ch == ";":
            flush()
            i += 1
            continue
        raw.append(ch)
        code.append(ch)
        i += 1
    flush()
    return statements


def strip_sql(text: str) -> str:
    """Comments removed and string/dollar bodies blanked, statements joined by ';'."""
    return ";\n".join(s.code for s in split_statements(text))


def strip_comments(text: str) -> str:
    """Comments removed, everything else kept, statements joined by ';'."""
    return ";\n".join(s.raw for s in split_statements(text))
