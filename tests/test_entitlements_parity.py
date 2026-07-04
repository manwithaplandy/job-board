"""Cross-language entitlement parity: dashboard/lib/entitlements.ts vs
reviewer/entitlements.py. Regex-extracts the model ids, per-model caps, and monthly
allowances from the TS source and asserts they equal the Python constants, so the
two tier-truth files can never silently drift (pattern: test_taxonomy_parity.py)."""
import re
from pathlib import Path

from reviewer.entitlements import CHEAP_MODEL, ENTITLEMENTS, PREMIUM_MODEL

_TS = Path(__file__).resolve().parent.parent / "dashboard" / "lib" / "entitlements.ts"


def _const(name: str, text: str) -> str:
    m = re.search(rf'export const {name}\s*=\s*"([^"]+)"', text)
    assert m, f"{name} not found in entitlements.ts"
    return m.group(1)


def _plan_block(plan: str, text: str) -> dict:
    """Parse `plan: { stage2Models: { ... }, monthlyResume: N, monthlyCover: N }`."""
    m = re.search(
        rf"{plan}:\s*\{{\s*stage2Models:\s*\{{([^}}]*)\}}\s*,\s*"
        rf"monthlyResume:\s*(\d+)\s*,\s*monthlyCover:\s*(\d+)",
        text,
    )
    assert m, f"{plan} entitlement not found in entitlements.ts"
    slots = {k: int(v) for k, v in re.findall(r"(\w+):\s*(\d+)", m.group(1))}
    return {
        "stage2_models": slots,
        "monthly_resume": int(m.group(2)),
        "monthly_cover": int(m.group(3)),
    }


def test_model_ids_parity():
    text = _TS.read_text()
    assert _const("CHEAP_MODEL", text) == CHEAP_MODEL
    assert _const("PREMIUM_MODEL", text) == PREMIUM_MODEL


def test_entitlement_table_parity():
    text = _TS.read_text()
    for plan in ("standard", "pro"):
        assert _plan_block(plan, text) == ENTITLEMENTS[plan], f"{plan} entitlement mismatch"


# ── T1: the two DB-overlay parsers must recognize the SAME jsonb config field names ──
# dashboard/lib/tierConfig.ts (overlayPlan) and reviewer/entitlements.py
# (overlay_entitlements) each read a tier_settings.config jsonb. If one recognizes a
# field the other ignores, an operator's retune would apply on only one runtime — a
# silent split-brain. This asserts both source files reference every overlay field.
_TIER_CFG_TS = Path(__file__).resolve().parent.parent / "dashboard" / "lib" / "tierConfig.ts"
_PY_OVERLAY = Path(__file__).resolve().parent.parent / "reviewer" / "entitlements.py"

# The entitlement-affecting fields (priceUsd is display-only, TS-side, so not mirrored).
# Both overlays iterate slot names generically from the compiled map, so only the
# top-level config field names need to be asserted equal across the two source files.
_OVERLAY_FIELDS = ("stage2Models", "monthlyResume", "monthlyCover")


def test_overlay_field_name_parity():
    ts = _TIER_CFG_TS.read_text()
    py = _PY_OVERLAY.read_text()
    for field in _OVERLAY_FIELDS:
        assert field in ts, f"{field} missing from tierConfig.ts"
        assert field in py, f"{field} missing from entitlements.py overlay"
    # priceUsd is the display-only knob and must live ONLY on the TS side.
    assert "priceUsd" in ts
    assert "priceUsd" not in py
