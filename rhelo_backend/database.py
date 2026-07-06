from __future__ import annotations

from contextlib import contextmanager
import sqlite3
from typing import Iterator

from .config import get_settings


def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(get_settings().database_path)
    connection.row_factory = sqlite3.Row
    return connection


@contextmanager
def connection() -> Iterator[sqlite3.Connection]:
    database = connect()
    try:
        yield database
    finally:
        database.close()


def database_is_ready() -> bool:
    try:
        with connection() as database:
            database.execute("SELECT 1 FROM verses LIMIT 1").fetchone()
        return True
    except (OSError, sqlite3.Error):
        return False
