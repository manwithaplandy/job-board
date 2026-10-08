import json,subprocess,sys
from pathlib import Path
s=json.loads(Path('tools/lifecycle_test_selection.json').read_text())
raise SystemExit(subprocess.call([sys.executable,'-m','pytest',*s['python'],'-vv','-ra','-o','faulthandler_timeout=20','--full-trace']))
