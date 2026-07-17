import asyncio
from types import SimpleNamespace

from job_discovery.location_llm import (
    LocationParse, LocationParseBatch, LocationParseClient, ParsedLocation,
)


def make_fake_client(result):
    """Stub matching the surface traced_structured_call uses:
    client.beta.chat.completions.parse(**kwargs) -> resp with .choices[0].message.parsed."""
    async def parse(**kwargs):
        msg = SimpleNamespace(parsed=result, refusal=None)
        return SimpleNamespace(
            choices=[SimpleNamespace(message=msg, finish_reason="stop")],
            usage=None, id=None, model="fake")
    completions = SimpleNamespace(parse=parse)
    return SimpleNamespace(beta=SimpleNamespace(chat=SimpleNamespace(completions=completions)))


def test_parse_batch_maps_indexes():
    result = LocationParseBatch(parses=[
        LocationParse(index=0, locations=[
            ParsedLocation(city="Boston", state="MA", country="US", remote=False)]),
        LocationParse(index=1, locations=[]),
    ])
    client = LocationParseClient(client=make_fake_client(result), model="fake")
    out = asyncio.run(client.parse_batch(["Greater Boston Area", "Gibberish"]))
    assert out[0][0].city == "Boston"
    assert out[1] == []


def test_parse_batch_drops_out_of_range_indexes():
    result = LocationParseBatch(parses=[
        LocationParse(index=7, locations=[ParsedLocation(city="Boston")]),
    ])
    client = LocationParseClient(client=make_fake_client(result), model="fake")
    out = asyncio.run(client.parse_batch(["only one input"]))
    assert out == {}


def test_missing_index_is_absent_not_empty():
    result = LocationParseBatch(parses=[LocationParse(index=0, locations=[])])
    client = LocationParseClient(client=make_fake_client(result), model="fake")
    out = asyncio.run(client.parse_batch(["a", "b"]))
    assert 0 in out and 1 not in out
