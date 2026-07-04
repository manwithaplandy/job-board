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
