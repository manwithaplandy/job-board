"""Gazetteer-anchored location resolution (rule pass).

geonamescache is the closed vocabulary: every canonical string is generated
from a gazetteer entry (or the fixed 'Remote' bucket) — never free text. The
LLM pass (location_llm.py) parses messy strings into {city, state, country}
fields that MUST validate back through resolve_fields(); an answer that does
not resolve here is rejected. Spec:
docs/superpowers/specs/2026-07-16-location-dedupe-design.md
"""
import re
from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True)
class Resolved:
    canonical: str
    kind: str  # 'city' | 'state' | 'country' | 'remote'
    geonameid: int | None = None
    country_code: str | None = None
    admin1_code: str | None = None


REMOTE = Resolved(canonical="Remote", kind="remote")

# Substring match (mirrors normalize.detect_remote): any component mentioning
# remote collapses to the single Remote bucket — "Remote - USA" and
# "Remote — Worldwide" are deliberately ONE facet entry (spec decision).
_REMOTE_RE = re.compile(r"remote|work from home|\bwfh\b", re.IGNORECASE)

# Multi-location delimiters ONLY. A " - " qualifier ("Remote - USA") is NOT a
# delimiter: that whole string is one component.
_SPLIT_RE = re.compile(r"\s+or\s+|\s*/\s*|\s*;\s*|\s*&\s*", re.IGNORECASE)

_PAREN_RE = re.compile(r"\([^)]*\)")

# Bounded spelling aliases the ISO tables don't carry. NOT place data (that all
# comes from geonamescache) — just common abbreviations of country references.
_COUNTRY_ALIASES = {
    "usa": "US", "u.s.": "US", "u.s.a.": "US",
    "united states of america": "US",
    "uk": "GB", "u.k.": "GB", "great britain": "GB",
}


@lru_cache(maxsize=1)
def _gazetteer():
    """(gc, countries_by_alias, states_by_alias), built once per process.

    countries_by_alias: lowercase name/iso2/iso3/alias -> (iso2, name)
    states_by_alias:    lowercase US state name/code   -> (code, name)
    """
    from geonamescache import GeonamesCache  # lazy: ~1s data load on first use

    gc = GeonamesCache(min_city_population=15000)
    countries: dict[str, tuple[str, str]] = {}
    for c in gc.get_countries().values():
        entry = (c["iso"], c["name"])
        for alias in (c["name"], c["iso"], c["iso3"]):
            countries[alias.lower()] = entry
    for alias, iso2 in _COUNTRY_ALIASES.items():
        countries[alias] = (iso2, gc.get_countries()[iso2]["name"])
    states: dict[str, tuple[str, str]] = {}
    for s in gc.get_us_states().values():
        entry = (s["code"], s["name"])
        states[s["name"].lower()] = entry
        states[s["code"].lower()] = entry
    return gc, countries, states


def _city_hits(gc, name: str) -> list[dict]:
    # Union of the two exact lookups: search_cities matches alternatenames
    # case-insensitively ("NYC", "münchen"); get_cities_by_name matches the
    # primary name case-sensitively. contains_search stays False — substring
    # mode returns garbage (e.g. "NYC" inside foreign alternate names).
    hits = {c["geonameid"]: c
            for c in gc.search_cities(name, case_sensitive=False, contains_search=False)}
    for d in gc.get_cities_by_name(name):
        for c in d.values():
            hits[c["geonameid"]] = c
    return list(hits.values())


def _city(gc, name: str, admin1: str | None = None,
          country: str | None = None) -> Resolved | None:
    hits = _city_hits(gc, name)
    if admin1:  # admin1 filtering is US-states-only (that's all we can parse)
        hits = [h for h in hits if h["countrycode"] == "US" and h["admin1code"] == admin1]
    if country:
        hits = [h for h in hits if h["countrycode"] == country]
    best = max(hits, key=lambda h: h["population"], default=None)
    if best is None:
        return None
    if best["countrycode"] == "US":
        canonical = f"{best['name']}, {best['admin1code']}"
    else:
        canonical = f"{best['name']}, {gc.get_countries()[best['countrycode']]['name']}"
    return Resolved(canonical, "city", int(best["geonameid"]),
                    best["countrycode"], best["admin1code"] or None)


def _state_resolved(state: tuple[str, str]) -> Resolved:
    code, name = state
    return Resolved(name, "state", country_code="US", admin1_code=code)


def _country_resolved(country: tuple[str, str]) -> Resolved:
    iso2, name = country
    return Resolved(name, "country", country_code=iso2)


def _parse_single(gc, countries, states, token: str) -> Resolved | None:
    c = countries.get(token.lower())
    if c:
        return _country_resolved(c)
    s = states.get(token.lower())
    if s:
        return _state_resolved(s)
    hit = _city(gc, token)
    if hit:
        return hit
    # Space-separated qualifier: "Austin Texas", "Austin TX", "Berlin Germany"
    words = token.split()
    if len(words) >= 2:
        head, tail = " ".join(words[:-1]), words[-1]
        s = states.get(tail.lower())
        if s:
            return _city(gc, head, admin1=s[0])
        c = countries.get(tail.lower())
        if c:
            return _city(gc, head, country=c[0])
    return None


def _parse_component(part: str) -> Resolved | None:
    gc, countries, states = _gazetteer()
    part = _PAREN_RE.sub(" ", part)
    part = re.sub(r"\s+", " ", part).strip(" ,-–—")
    if not part:
        return None
    if _REMOTE_RE.search(part):
        return REMOTE
    tokens = [t.strip() for t in part.split(",") if t.strip()]
    if not tokens:
        return None
    if len(tokens) == 1:
        return _parse_single(gc, countries, states, tokens[0])
    # Comma-form shapes seen in ATS data: [City, ST] · [City, Country] ·
    # [State, Country] · [City, ST, Country] · [City, Region, Country].
    #
    # ORDER MATTERS: US state codes collide with ISO country codes ("MN" is
    # Minnesota AND Mongolia, "CA" is California AND Canada, "DE" is Delaware
    # AND Germany). Try the STATE interpretation first, accepted only when a
    # real city resolves under that state — "Austin, MN" finds Austin,
    # Minnesota and never consults Mongolia; "Berlin, DE" finds no Berlin,
    # Delaware (< 15k pop) and correctly falls through to Germany.
    tail = tokens[-1].lower()
    state = states.get(tail)
    if state:
        hit = _city(gc, ", ".join(tokens[:-1]), admin1=state[0])
        if hit:
            return hit
    country = countries.get(tail)
    if country:
        rest = tokens[:-1]
        # [State, Country]: "Texas, USA"
        if len(rest) == 1:
            s = states.get(rest[0].lower())
            if s and country[0] == "US":
                return _state_resolved(s)
        # [City, ST, Country]: state qualifier just before the country
        if len(rest) >= 2:
            s = states.get(rest[-1].lower())
            if s and country[0] == "US":
                hit = _city(gc, ", ".join(rest[:-1]), admin1=s[0])
                if hit:
                    return hit
        # [City, Country] — and [City, Region, Country] by dropping the
        # unparseable inner region qualifier
        hit = _city(gc, ", ".join(rest), country=country[0])
        if hit:
            return hit
        if len(rest) >= 2:
            hit = _city(gc, ", ".join(rest[:-1]), country=country[0])
            if hit:
                return hit
        return None
    # Neither a state nor a country qualifier: try the whole thing as an
    # exact city name ("Washington, D.C." is a GeoNames primary name).
    return _city(gc, ", ".join(tokens))


def resolve_location(raw: str) -> list[Resolved]:
    """Rule-pass resolution of one raw location string.

    All-or-nothing: every delimiter-separated component must resolve, or []
    is returned and the LLM pass adjudicates the whole string. The result is
    deduped preserving order ("Remote / Remote - US" -> [REMOTE]).
    """
    if not raw or not raw.strip():
        return []
    out: list[Resolved] = []
    for part in _SPLIT_RE.split(raw.strip()):
        if not part.strip():
            continue
        r = _parse_component(part)
        if r is None:
            return []
        if r not in out:
            out.append(r)
    return out


def resolve_fields(city: str | None, state: str | None, country: str | None,
                   remote: bool = False) -> Resolved | None:
    """Validate one LLM-parsed element against the gazetteer. None = rejected.

    remote=True short-circuits to the Remote bucket (spec: remote variants
    collapse regardless of any stated region). A stated state/country that the
    gazetteer can't place, or a city that doesn't exist under the stated
    qualifiers, rejects the element — the LLM parses, it never invents.
    """
    if remote:
        return REMOTE
    gc, countries, states = _gazetteer()
    # Normalize: strip each field; a whitespace-only value is absent for
    # resolution. But a city that was *provided* yet blank is still a failed
    # city attempt (city_present) — it must not silently downgrade to its bare
    # country: ("   ", None, "US") is rejected, not read as the United States.
    city_present = city is not None
    city = (city or "").strip()
    state = (state or "").strip()
    country = (country or "").strip()
    iso2 = admin1 = None
    if country:
        hit = countries.get(country.lower())
        if hit is None:
            return None
        iso2 = hit[0]
    if state:
        s = states.get(state.lower())
        if s is not None:
            admin1 = s[0]
        # a non-US "state" (e.g. Bavaria) is ignored; the country constrains
    if city:
        return _city(gc, city, admin1=admin1, country=iso2)
    if admin1:
        # A US-state resolution can't coexist with a stated non-US country
        # ("TX" + "Canada"): reject rather than drop the country.
        if iso2 is not None and iso2 != "US":
            return None
        return _state_resolved(states[state.lower()])
    if iso2 and not city_present:
        return _country_resolved(countries[country.lower()])
    return None
