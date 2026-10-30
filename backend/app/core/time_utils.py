"""
Vigil AI Security — Thailand Timezone Utilities
Provides centralized timezone handling for Thailand (UTC+7 / Asia/Bangkok / ICT).
Ensures database records, alerts, history, API responses, and emails strictly use Thailand time.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional

# Thailand Timezone definition (UTC+7 / Asia/Bangkok)
THAILAND_TZ = timezone(timedelta(hours=7), name="Asia/Bangkok")


def get_thailand_now() -> datetime:
    """Returns current datetime in Thailand timezone (UTC+7, timezone-aware)."""
    return datetime.now(THAILAND_TZ)


def get_thailand_naive_now() -> datetime:
    """
    Returns current Thailand local time as a naive datetime object.
    Ideal for storing in SQLite columns so that raw SQLite timestamps
    directly match Thailand local clock (e.g. 18:30:00).
    """
    return datetime.now(THAILAND_TZ).replace(tzinfo=None)


def get_thailand_today_start() -> datetime:
    """
    Returns start of current day (00:00:00.000000) in Thailand time as naive datetime.
    Used for daily detection stats and alert queries in SQLite.
    """
    now_th = get_thailand_now()
    return now_th.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)


def format_thailand_time(
    dt: Optional[datetime] = None,
    fmt: str = "%d/%m/%Y %H:%M:%S",
    include_thai_label: bool = False,
) -> str:
    """
    Formats a datetime object to a formatted Thailand time string.
    If dt is None, uses the current Thailand time.
    """
    if dt is None:
        dt = get_thailand_now()
    elif dt.tzinfo is None:
        dt = dt.replace(tzinfo=THAILAND_TZ)
    else:
        dt = dt.astimezone(THAILAND_TZ)

    formatted = dt.strftime(fmt)
    if include_thai_label:
        formatted += " (เวลาไทย)"
    return formatted


def serialize_thailand_datetime(dt: Optional[datetime]) -> Optional[str]:
    """
    Serializes a datetime to ISO 8601 string with explicit +07:00 timezone offset.
    If input is naive, it assumes it represents Thailand local time.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=THAILAND_TZ)
    else:
        dt = dt.astimezone(THAILAND_TZ)
    return dt.isoformat()
