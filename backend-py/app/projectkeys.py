"""Project key helpers — short uppercase identifiers used to build task ids."""

# Prefix for tasks that don't belong to any project (e.g. TSK-001).
WORKSPACE_TASK_KEY = "TSK"


def normalize_key(raw: str) -> str:
    return raw.strip().upper()


def generate_project_key(name: str, taken: set[str]) -> str:
    """A 3-char key derived from the name, made unique against `taken`."""
    letters = [c for c in name.upper() if c.isalpha()]
    base = "".join(letters[:3]) or "PRJ"
    if len(base) < 3:
        base = (base + "XXX")[:3]
    candidate = base
    n = 1
    while candidate in taken:
        suffix = str(n)
        candidate = (base[: max(0, 3 - len(suffix))] + suffix) or suffix
        n += 1
    return candidate
