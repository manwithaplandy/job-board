"""JSON CLI; no arguments accepted."""
import json
import sys

from . import get_supabase_storage_metrics


def main(argv=None):
    if (sys.argv[1:] if argv is None else argv):
        print(json.dumps({'status': 'invalid', 'errors': ['arguments_not_supported']}))
        return 2
    result = get_supabase_storage_metrics()
    print(json.dumps(result, allow_nan=False))
    return 0 if result['status'] == 'ok' else 1


if __name__ == '__main__':
    raise SystemExit(main())
