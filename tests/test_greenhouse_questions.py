import json
from pathlib import Path

from job_discovery.adapters.greenhouse import parse_greenhouse_questions

FIXTURE = json.loads(
    (Path(__file__).parent / "fixtures" / "greenhouse_questions.json").read_text()
)

# The canonical parsed shape — Task 5's TypeScript test asserts this SAME expected
# object against the SAME fixture so the two parsers cannot drift.
EXPECTED = {
    "questions": [
        {"label": "Why do you want to work here?", "required": True,
         "fields": [{"name": "question_0", "type": "textarea", "options": []}]},
        {"label": "Are you authorized to work in the US?", "required": True,
         "fields": [{"name": "question_1", "type": "multi_value_single_select",
                     "options": [{"value": "0", "label": "Yes"},
                                 {"value": "1", "label": "No"}]}]},
        {"label": "Cover Letter", "required": False,
         "fields": [{"name": "cover_letter", "type": "input_file", "options": []}]},
        # the label-less question is dropped
    ]
}


def test_parses_fixture_to_canonical_shape():
    assert parse_greenhouse_questions(FIXTURE) == EXPECTED


def test_non_object_returns_none():
    assert parse_greenhouse_questions(None) is None
    assert parse_greenhouse_questions([]) is None
    assert parse_greenhouse_questions({"questions": "nope"}) is None


def test_numeric_option_values_stringified():
    out = parse_greenhouse_questions(
        {"questions": [{"label": "Q", "required": False,
                        "fields": [{"name": "f", "type": "t",
                                    "values": [{"value": 0, "label": "Zero"}]}]}]}
    )
    assert out["questions"][0]["fields"][0]["options"] == [{"value": "0", "label": "Zero"}]


def test_option_missing_label_dropped_but_empty_value_kept():
    out = parse_greenhouse_questions(
        {"questions": [{"label": "Q", "required": False,
                        "fields": [{"name": "f", "type": "t",
                                    "values": [{"value": "", "label": "Keep"},
                                               {"value": "x", "label": ""}]}]}]}
    )
    assert out["questions"][0]["fields"][0]["options"] == [{"value": "", "label": "Keep"}]


def test_field_dropped_only_when_name_and_type_both_empty():
    out = parse_greenhouse_questions(
        {"questions": [{"label": "Q", "required": True,
                        "fields": [{"name": "", "type": "", "values": []},
                                   {"name": "keep", "type": "", "values": []}]}]}
    )
    assert out["questions"][0]["fields"] == [{"name": "keep", "type": "", "options": []}]
