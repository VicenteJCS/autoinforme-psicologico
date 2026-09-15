#!/usr/bin/env python3
import re
import sys
import production


def publication_guard(paper, watch_start):
    published = paper.get("published") or ""
    created = paper.get("created") or ""
    if re.match(r"^\d{4}-\d{2}-\d{2}", published):
        return published[:10] >= watch_start
    if re.match(r"^\d{4}-\d{2}-\d{2}", created):
        return created[:10] >= watch_start
    return False


production.is_after_watch_start = publication_guard

if __name__ == "__main__":
    try:
        raise SystemExit(production.main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
