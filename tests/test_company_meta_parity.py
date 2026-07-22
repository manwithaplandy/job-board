import re
from pathlib import Path

from company_discovery.schemas import COMPANY_SIZES

_TS = Path(__file__).resolve().parent.parent / "dashboard" / "lib" / "companyMeta.ts"


def test_company_sizes_parity():
    text = _TS.read_text()
    m = re.search(r"export const COMPANY_SIZES\s*=\s*\[([^\]]*)\]", text)
    assert m, "COMPANY_SIZES not found in companyMeta.ts"
    ts_sizes = re.findall(r'"([^"]+)"', m.group(1))
    assert ts_sizes == COMPANY_SIZES
