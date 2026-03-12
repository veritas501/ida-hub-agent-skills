from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="IDA_HUB_", extra="ignore")

    host: str = "0.0.0.0"
    port: int = 10086
    debug: bool = False
    execute_timeout: float = Field(default=30.0, gt=0.0)
    web_root: Path | None = None
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    def resolved_web_root(self) -> Path | None:
        if self.web_root is not None:
            root = self.web_root.expanduser().resolve()
            if root.exists() and root.is_dir():
                return root
            return None

        # Default to repo-level hub_frontend/out for local integration.
        root = _default_web_root()
        if root is None or not root.exists() or not root.is_dir():
            return None
        return root

    def resolved_cors_origins(self) -> list[str]:
        return [
            item.strip()
            for item in self.cors_origins.split(",")
            if item.strip()
        ]


def _default_web_root() -> Path | None:
    repo_root = Path(__file__).resolve().parents[3]
    return repo_root / "hub_frontend" / "out"
