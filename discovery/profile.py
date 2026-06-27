import hashlib


def compute_company_profile_version(company_instructions: str | None) -> str:
    """sha256 of the company preferences — the company-review invalidation key.

    MUST match dashboard/lib/companyProfileVersion.ts.
    """
    return hashlib.sha256((company_instructions or "").encode("utf-8")).hexdigest()
