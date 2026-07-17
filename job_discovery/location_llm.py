"""Batched LLM parse of raw location strings the gazetteer rules can't resolve.

The model PARSES text into {city, state, country, remote} fields; it never
produces canonical strings. Every element is validated back through
gazetteer.resolve_fields() by the caller (locations.py) — an element that
doesn't resolve is dropped, and a string with zero surviving elements is
stored unmappable. Mirrors company_discovery/llm.py's client shape.
"""
import os

from pydantic import BaseModel

from observability.llm import traced_structured_call

DEFAULT_MODEL = "deepseek/deepseek-v4-flash"
_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
BATCH_SIZE = 40

_INSTRUCTIONS = (
    "You normalize job-posting LOCATION strings. For each numbered input "
    "string, extract EVERY distinct place it names.\n"
    "- Return exactly one `parses` entry per input, carrying that input's "
    "index number.\n"
    "- Each place is {city, state, country, remote}. Use English exonyms "
    "('Munich', not 'München'). state: US state name or 2-letter code; null "
    "outside the US. country: country name or ISO code; null if unstated.\n"
    "- remote: true when that part of the string offers remote work "
    "('Remote', 'Remote - USA', 'WFH', 'anywhere'); leave city/state/country "
    "null for a purely remote mention.\n"
    "- A string naming several places ('NYC or Remote', 'Berlin / London') "
    "yields several entries in `locations`.\n"
    "- locations: [] when the string names no resolvable real-world place "
    "('Multiple Locations', 'See posting', team or building names).\n"
    "- Never invent a place that is not clearly named in the string."
)


class ParsedLocation(BaseModel):
    city: str | None = None
    state: str | None = None
    country: str | None = None
    remote: bool = False


class LocationParse(BaseModel):
    index: int
    locations: list[ParsedLocation]


class LocationParseBatch(BaseModel):
    parses: list[LocationParse]


class LocationParseClient:
    def __init__(self, client=None, model: str | None = None):
        if client is None:
            from openai import AsyncOpenAI  # lazy: avoid import + key read at module load
            client = AsyncOpenAI(
                base_url=_OPENROUTER_BASE_URL,
                api_key=os.environ["OPENROUTER_API_KEY"],
                default_headers={"X-Title": "job-board"},
            )
        self._client = client
        self.model = model or os.environ.get("LOCATION_MODEL", DEFAULT_MODEL)

    async def parse_batch(self, raws: list[str]) -> dict[int, list[ParsedLocation]]:
        """Parse up to BATCH_SIZE raw strings in one call.

        Returns {input_index: places}. An index the model didn't answer is
        ABSENT (not []): the caller leaves that raw unmapped so a later run
        retries it, whereas an explicit [] means "no real place named" and
        becomes an unmappable row.
        """
        numbered = "\n".join(f"{i}: {r}" for i, r in enumerate(raws))
        parsed, _ = await traced_structured_call(
            self._client,
            model=self.model,
            messages=[
                {"role": "system", "content": _INSTRUCTIONS},
                {"role": "user", "content": numbered},
            ],
            schema=LocationParseBatch,
            name="location-parse",
            metadata={"batch_size": len(raws)},
            # Deterministic parsing (spec: temperature 0). traced_structured_call
            # merges extra_body into the request JSON, so this reaches OpenRouter.
            extra_body={"temperature": 0},
        )
        return {p.index: p.locations for p in parsed.parses if 0 <= p.index < len(raws)}
