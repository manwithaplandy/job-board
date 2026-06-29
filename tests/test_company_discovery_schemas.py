import hashlib

from company_discovery.profile import compute_company_profile_version
from company_discovery.schemas import CompanyReviewResult


def test_version_is_sha256_of_instructions():
    assert compute_company_profile_version("prefer devtools") == \
        hashlib.sha256(b"prefer devtools").hexdigest()
    assert compute_company_profile_version(None) == hashlib.sha256(b"").hexdigest()


def test_result_parses_with_defaults():
    r = CompanyReviewResult.model_validate({"verdict": "unknown"})
    assert r.verdict == "unknown"
    assert r.confidence == "low"
    assert r.tech_tags == [] and r.red_flags == []
    assert r.industry is None


def test_result_full():
    r = CompanyReviewResult.model_validate({
        "verdict": "exclude", "confidence": "high", "reasoning": "defense",
        "industry": "industrial_hardware",
        "industry_subcategory": "automotive_aerospace_defense",
        "tech_tags": ["c++"], "red_flags": ["defense"],
    })
    assert r.verdict == "exclude" and r.tech_tags == ["c++"]
