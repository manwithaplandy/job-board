import langfuse


def test_langfuse_client_exposes_methods_the_seam_calls():
    cls = langfuse.Langfuse
    for method in ("start_as_current_observation", "create_dataset",
                   "create_dataset_item", "get_dataset", "flush"):
        assert hasattr(cls, method), f"langfuse.Langfuse is missing {method!r}"
    # Regression guard: the v3 method below does NOT exist in v4; production code
    # must not call it (it raised AttributeError at runtime). See review 2026-06-28.
    assert not hasattr(cls, "update_current_trace")
