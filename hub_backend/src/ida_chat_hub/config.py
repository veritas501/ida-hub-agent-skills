from __future__ import annotations

import functools
import sys
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

if sys.version_info >= (3, 9):
    from importlib.resources import files
else:
    from importlib_resources import files  # type: ignore[import]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="IDA_HUB_", extra="ignore")

    host: str = "0.0.0.0"
    port: int = 10086
    debug: bool = False
    execute_timeout: float = Field(default=30.0, gt=0.0)
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    # Development mode: proxy frontend requests to Next.js dev server
    dev_mode: bool = False
    dev_proxy_url: str = "http://127.0.0.1:3000"

    def resolved_web_root(self) -> Path | None:
        # Priority 1: Packaged static files (for pip installed distribution)
        packaged_root = _packaged_static_root()
        if packaged_root is not None:
            return packaged_root

        # Priority 2: Repo-level hub_frontend/out (for local development)
        repo_root = _repo_web_root()
        if repo_root is not None and repo_root.exists() and repo_root.is_dir():
            return repo_root

        return None

    def resolved_cors_origins(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@functools.cache
def _packaged_static_root() -> Path | None:
    """Get static files path from installed package (cached)."""
    try:
        # Use importlib.resources to access package data
        static_files = files("ida_chat_hub").joinpath("static")
        # For Python 3.9+, files() returns a Traversable
        # We need to get the actual filesystem path
        if hasattr(static_files, "is_dir") and static_files.is_dir():
            # This works for both editable installs and regular installs
            return Path(str(static_files))
    except (ImportError, TypeError, AttributeError):
        pass
    return None


def _repo_web_root() -> Path | None:
    """Get web root from repo directory structure (local development)."""
    repo_root = Path(__file__).resolve().parents[3]
    return repo_root / "hub_frontend" / "out"
