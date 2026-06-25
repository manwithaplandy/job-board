from reviewer.profile import compute_profile_version


def test_known_vectors():
    assert compute_profile_version("", "") == (
        "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d"
    )
    # None is treated as empty -> identical to empty/empty
    assert compute_profile_version(None, None) == compute_profile_version("", "")
    assert compute_profile_version("Alice resume", "focus backend") == (
        "54ca176e51d41e4cd93a5ff3d49fc12ab756df0d81223c3f5e0c14feb425b37c"
    )


def test_changes_when_either_field_changes():
    base = compute_profile_version("r", "i")
    assert compute_profile_version("r2", "i") != base
    assert compute_profile_version("r", "i2") != base
