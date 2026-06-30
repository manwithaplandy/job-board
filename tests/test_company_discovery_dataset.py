import json
from pathlib import Path

from company_discovery.dataset import Candidate, load_candidates

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "company_discovery"


def test_loads_and_normalizes_rows():
    cands = load_candidates(FIXTURES)
    by_key = {(c.ats, c.token): c for c in cands}
    assert ("greenhouse", "stripe") in by_key          # dict row {name, token}
    assert by_key[("greenhouse", "stripe")].name == "Stripe"
    assert ("lever", "netflix") in by_key              # bare-string row -> token==name
    assert ("ashby", "linear") in by_key
    assert all(c.ats in ("greenhouse", "lever", "ashby") for c in cands)


def test_dedups_and_lowercases_tokens():
    cands = load_candidates(FIXTURES)
    tokens = [(c.ats, c.token) for c in cands]
    assert len(tokens) == len(set(tokens))             # no dups
    assert all(c.token == c.token.lower() for c in cands)


def test_skips_malformed_and_missing(tmp_path):
    (tmp_path / "greenhouse_companies.json").write_text(
        json.dumps([{"token": "ok"}, {"name": "no token"}, 12345, {"token": ""}])
    )
    # no lever/ashby files present
    cands = load_candidates(tmp_path)
    assert [(c.ats, c.token) for c in cands] == [("greenhouse", "ok")]


def test_tolerates_bad_json(tmp_path):
    (tmp_path / "lever_companies.json").write_text("{not json")
    assert load_candidates(tmp_path) == []


def test_skips_malformed_workday_tokens(tmp_path):
    # FIX 4: Workday tokens pack a 'tenant:datacenter:site' triple; rows whose token
    # is not a well-formed triple are dropped (matching the skip-malformed policy).
    (tmp_path / "workday_companies.json").write_text(json.dumps([
        {"name": "Good", "token": "acme:wd5:External"},
        {"name": "Two", "token": "acme:wd5"},
        {"name": "Empty seg", "token": "acme::External"},
        {"name": "Plain", "token": "plain"},
    ]))
    cands = load_candidates(tmp_path)
    # case-sensitive token preserved verbatim; only the well-formed triple survives
    assert [(c.ats, c.token) for c in cands] == [("workday", "acme:wd5:External")]
