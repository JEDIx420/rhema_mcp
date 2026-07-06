from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import os
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    database_path: Path
    api_host: str = "127.0.0.1"
    api_port: int = 5050
    product_name: str = "Rhelo Study Engine"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    project_root = Path(__file__).resolve().parent.parent
    database_path = Path(
        os.environ.get("RHELO_DB_PATH", project_root / "rhelo.db")
    ).expanduser().resolve()
    return Settings(
        database_path=database_path,
        api_host=os.environ.get("RHELO_API_HOST", "127.0.0.1"),
        api_port=int(os.environ.get("RHELO_API_PORT", "5050")),
    )
