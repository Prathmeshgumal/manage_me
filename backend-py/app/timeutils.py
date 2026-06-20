from datetime import datetime, timezone


def to_naive_utc(dt: datetime | None) -> datetime | None:
    """Normalize an incoming datetime to naive UTC for `timestamp without time zone` columns."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def iso_z(dt: datetime | None) -> str | None:
    """Serialize a naive-UTC datetime as an ISO string with a trailing Z (matches JS toISOString)."""
    if dt is None:
        return None
    return dt.isoformat() + "Z"
