"""Centralized logging setup.

Privacy rule: logs must NEVER contain raw video frames, images, or biometric data.
Only event metadata (type, severity, timestamps) is ever logged.
"""

from __future__ import annotations

import logging

from app.core.config import get_settings

_CONFIGURED = False


def setup_logging() -> None:
    """Configure root logging once, idempotently."""
    global _CONFIGURED
    if _CONFIGURED:
        return

    level = getattr(logging, get_settings().log_level.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    )
    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    """Return a namespaced logger, ensuring logging is configured first."""
    setup_logging()
    return logging.getLogger(name)
