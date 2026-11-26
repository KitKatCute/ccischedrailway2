"""
id_utils.py
-----------
Shared helper for converting "FA-023"-style faculty codes into deterministic
numeric database IDs. Used by both init_db.py (when seeding faculty) and
app.py (when loading historical assignment data for RF training), so the
two always agree on the same mapping without a runtime lookup table.
"""

import re


def fa_to_id(code: str) -> int:
    """'FA-023' -> 24. Falls back to hashing unrecognized formats so the
    pipeline doesn't crash on an unexpected code, though every faculty
    record should use the FA-### convention."""
    code = str(code).strip()
    match = re.search(r"(\d+)", code)
    if match:
        if re.fullmatch(r"FA-\d+", code, flags=re.IGNORECASE):
            return int(match.group(1)) + 1
        # Non-FA-### codes (e.g. demo accounts "FADEMO-000") get their own
        # range so they can't collide with real faculty ids (FADEMO-000 would
        # otherwise map to 1 and overwrite FA-000).
        return int(match.group(1)) + 1000
    return abs(hash(code)) % 100000 + 100000   # unlikely fallback, kept safe/high
