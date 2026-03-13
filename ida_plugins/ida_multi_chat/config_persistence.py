"""Config persistence layer for IDA Multi Chat plugin."""

import ast
import json
import os
from typing import Any

from ida_multi_chat.hub_client import HubConfig


class HubConfigPersistence:
    """Load and save Hub client settings from JSON file."""

    def __init__(self, config_path: str | None = None) -> None:
        package_dir = os.path.dirname(os.path.abspath(__file__))
        self._config_path = config_path or os.path.join(package_dir, ".hub_config.json")

    @property
    def config_path(self) -> str:
        """Return absolute config file path."""

        return self._config_path

    def load(self) -> HubConfig:
        """Load config from disk with defensive parsing and sane defaults."""

        default = HubConfig()
        if not os.path.exists(self._config_path):
            return default

        try:
            with open(self._config_path, "r", encoding="utf-8") as handle:
                raw_data = json.load(handle)
        except (OSError, ValueError, TypeError):
            return default

        if not isinstance(raw_data, dict):
            return default

        return HubConfig(
            host=self._read_host(raw_data.get("host"), default.host),
            port=self._read_int(raw_data.get("port"), default.port),
            reconnect_interval=self._read_float(
                raw_data.get("reconnect_interval"),
                default.reconnect_interval,
            ),
            auto_connect=self._read_bool(
                raw_data.get("auto_connect"),
                default.auto_connect,
            ),
        )

    def save(self, config: HubConfig) -> None:
        """Persist config to JSON file."""

        payload = {
            "host": config.host,
            "port": config.port,
            "reconnect_interval": config.reconnect_interval,
            "auto_connect": config.auto_connect,
        }
        with open(self._config_path, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=4, ensure_ascii=True)

    @staticmethod
    def _read_host(raw_value: Any, default: str) -> str:
        """Parse host field with compatibility for malformed legacy values."""

        if isinstance(raw_value, dict):
            raw_value = raw_value.get("host")

        value = str(raw_value or "").strip()
        if value.startswith("{") and "host" in value:
            try:
                parsed = ast.literal_eval(value)
                if isinstance(parsed, dict):
                    nested_host = str(parsed.get("host") or "").strip()
                    if nested_host:
                        value = nested_host
            except (ValueError, SyntaxError):
                pass
        return value or default

    @staticmethod
    def _read_int(raw_value: Any, default: int) -> int:
        """Parse int value; fallback to default on parse errors."""

        try:
            return int(raw_value)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _read_float(raw_value: Any, default: float) -> float:
        """Parse float value; fallback to default on parse errors."""

        try:
            return float(raw_value)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _read_bool(raw_value: Any, default: bool) -> bool:
        """Parse bool-like values from bool/int/float/string."""

        if isinstance(raw_value, bool):
            return raw_value
        if isinstance(raw_value, (int, float)):
            return bool(raw_value)
        if isinstance(raw_value, str):
            text = raw_value.strip().lower()
            if text in {"1", "true", "yes", "y", "on"}:
                return True
            if text in {"0", "false", "no", "n", "off"}:
                return False
        return default
