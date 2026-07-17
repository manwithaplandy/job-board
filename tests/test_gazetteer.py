from job_discovery.gazetteer import REMOTE, Resolved, resolve_fields, resolve_location


def canonicals(raw):
    return [r.canonical for r in resolve_location(raw)]


# -- the motivating variants from the spec ------------------------------------

def test_remote_variants_collapse_to_single_bucket():
    for raw in ["Remote", "remote", "Remote - USA", "Remote - United States",
                "Remote — Worldwide", "100% Remote", "Remote (US)"]:
        assert resolve_location(raw) == [REMOTE], raw


def test_austin_variants_all_map_to_austin_tx():
    for raw in ["Austin", "Austin TX", "Austin Texas", "Austin, TX",
                "Austin, Texas", "Austin, Texas, United States"]:
        rs = resolve_location(raw)
        assert canonicals(raw) == ["Austin, TX"], raw
        assert rs[0].kind == "city"
        assert rs[0].country_code == "US" and rs[0].admin1_code == "TX"
        assert rs[0].geonameid is not None


def test_multi_location_string_maps_to_every_place():
    assert canonicals("NYC or Remote") == ["New York City, NY", "Remote"]
    assert canonicals("Berlin / London") == ["Berlin, Germany", "London, United Kingdom"]


# -- kinds beyond city ---------------------------------------------------------

def test_country_only():
    for raw in ["United States", "USA", "US"]:
        rs = resolve_location(raw)
        assert [r.canonical for r in rs] == ["United States"], raw
        assert rs[0].kind == "country" and rs[0].country_code == "US"


def test_state_only():
    rs = resolve_location("Texas")
    assert [r.canonical for r in rs] == ["Texas"]
    assert rs[0].kind == "state" and rs[0].admin1_code == "TX"


def test_state_with_country():
    assert canonicals("Texas, USA") == ["Texas"]


def test_non_us_city_canonical_uses_country_name():
    rs = resolve_location("London, United Kingdom")
    assert [r.canonical for r in rs] == ["London, United Kingdom"]
    assert rs[0].country_code == "GB"
    # bare "London" resolves to the biggest London (GB), not London, Ontario
    assert canonicals("London") == ["London, United Kingdom"]


def test_ambiguous_city_picks_population_max():
    # Austin, MN (24k) exists; population-max picks Austin, TX
    assert canonicals("Austin") == ["Austin, TX"]


def test_state_qualifier_disambiguates():
    rs = resolve_location("Austin, MN")
    assert [r.canonical for r in rs] == ["Austin, MN"]


# -- refusal paths --------------------------------------------------------------

def test_unresolvable_returns_empty():
    assert resolve_location("Multiple Locations") == []
    assert resolve_location("See posting") == []
    assert resolve_location("") == []


def test_partially_resolvable_multi_string_returns_empty():
    # all-or-nothing: rules must not half-answer; the LLM gets the whole string
    assert resolve_location("Austin, TX / Fooville Fake") == []


def test_dedupe_preserves_order():
    assert canonicals("Remote / Remote - US") == ["Remote"]


# -- resolve_fields (the LLM-output validator) ----------------------------------

def test_resolve_fields_valid_city():
    r = resolve_fields("Austin", "TX", "US")
    assert r is not None and r.canonical == "Austin, TX"


def test_resolve_fields_state_name():
    r = resolve_fields("Austin", "Texas", "United States")
    assert r is not None and r.canonical == "Austin, TX"


def test_resolve_fields_remote_wins():
    assert resolve_fields("Austin", "TX", "US", remote=True) == REMOTE


def test_resolve_fields_hallucinated_city_rejected():
    assert resolve_fields("Atlantisville", None, "US") is None


def test_resolve_fields_conflicting_state_country_rejected():
    assert resolve_fields("Austin", "TX", "Canada") is None


def test_resolve_fields_country_only():
    r = resolve_fields(None, None, "Germany")
    assert r is not None and r.canonical == "Germany" and r.kind == "country"


def test_resolve_fields_nothing_given():
    assert resolve_fields(None, None, None) is None


def test_resolve_fields_blank_city_rejected():
    assert resolve_fields("   ", None, "US") is None


def test_resolve_fields_blank_city_with_valid_state_resolves_state():
    r = resolve_fields("  ", "Texas", "US")
    assert r is not None and r.canonical == "Texas" and r.kind == "state"


def test_resolve_fields_state_conflicting_country_rejected():
    assert resolve_fields(None, "TX", "Canada") is None
