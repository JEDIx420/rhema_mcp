"""Finalize the generated seed database for desktop packaging."""

from pathlib import Path
import sqlite3


ROOT = Path(__file__).resolve().parent.parent
DATABASE_PATH = ROOT / "rhelo.db"
SCHEMA_VERSION_PATH = ROOT / "schema-version.txt"


def read_schema_version() -> int:
    value = SCHEMA_VERSION_PATH.read_text(encoding="ascii").strip()
    version = int(value)
    if version < 0:
        raise ValueError("Schema version must be non-negative.")
    return version


def main() -> None:
    schema_version = read_schema_version()
    if not DATABASE_PATH.exists():
        raise FileNotFoundError(f"Seed database not found: {DATABASE_PATH}")

    connection = sqlite3.connect(DATABASE_PATH)
    try:
        connection.execute(f"PRAGMA user_version = {schema_version}")
        connection.commit()
        stored_version = connection.execute("PRAGMA user_version").fetchone()[0]
        if stored_version != schema_version:
            raise RuntimeError(
                f"Seed database version verification failed: expected {schema_version}, got {stored_version}"
            )
    finally:
        connection.close()

    print(f"Seed database finalized at schema version {schema_version}.")


if __name__ == "__main__":
    main()
