"""Cross-language taxonomy parity: dashboard/lib/config.ts vs reviewer/schemas.py."""
import re
from pathlib import Path

from reviewer.schemas import INDUSTRIES, SUBCATEGORIES

_CONFIG_TS = Path(__file__).resolve().parent.parent / "dashboard" / "lib" / "config.ts"


def _extract_array(name: str, text: str) -> list[str]:
    """Extract all single- or double-quoted tokens from `export const NAME = [ ... ] as const;`."""
    m = re.search(rf"export const {name}\s*=\s*\[(.*?)\]\s*as const", text, re.DOTALL)
    assert m, f"{name} not found in config.ts"
    return re.findall(r'["\']([^"\']+)["\']', m.group(1))


def test_taxonomy_parity():
    text = _CONFIG_TS.read_text()
    industry_options = _extract_array("INDUSTRY_OPTIONS", text)
    subcategory_options = _extract_array("SUBCATEGORY_OPTIONS", text)
    verdict_options = _extract_array("VERDICT_OPTIONS", text)
    experience_options = _extract_array("EXPERIENCE_OPTIONS", text)

    assert industry_options == INDUSTRIES, (
        f"INDUSTRY_OPTIONS mismatch: config.ts={industry_options} vs schemas.py={INDUSTRIES}"
    )
    assert subcategory_options == SUBCATEGORIES, (
        f"SUBCATEGORY_OPTIONS mismatch: config.ts={subcategory_options} vs schemas.py={SUBCATEGORIES}"
    )
    assert set(experience_options) == {"step_down", "match", "reach", "far_reach"}
    assert set(verdict_options) == {"approve", "deny", "gate_rejected", "pending", "all"}
