"""Database setup (SQLAlchemy 2.0, SQLite for development).

Wrapped behind a repository layer (see `repository.py`) so the storage engine can be
swapped for PostgreSQL/TimescaleDB later without touching feature code.
"""

from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import get_settings

settings = get_settings()

# `check_same_thread` is a SQLite-only flag needed for FastAPI's threadpool usage.
_connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(settings.database_url, connect_args=_connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


def init_db() -> None:
    """Create tables if they don't exist. Safe to call on every startup."""
    # Import models so they register with the metadata before create_all.
    from app.db import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
