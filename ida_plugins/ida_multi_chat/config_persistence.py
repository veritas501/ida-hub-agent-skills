import json
import os
from typing import Any

from ida_multi_chat.hub_client import HubConfig


class HubConfigPersistence:
    def __init__(self, config_path: str | None = None) -> None:
        package_dir = os.path.dirname(os.path.abspath(__file__))
        self._config_path = config_path or os.path.join(package_dir, ".hub_config.json")

    @property
    def config_path(self) -> str:
        return self._config_path

    def load(self) -> HubConfig:
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
            host=self._read_host(raw_data, default.host),
            port=self._read_int(raw_data.get("port"), default.port),
            reconnect_interval=self._read_float(
                raw_data.get("reconnect_interval"),
                default.reconnect_interval,
            ),
        )

    def save(self, config: HubConfig) -> None:
        payload = {
            "host": config.host,
            "port": config.port,
            "reconnect_interval": config.reconnect_interval,
        }
        with open(self._config_path, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=4, ensure_ascii=True)

    @staticmethod
    def _read_host(raw_value: Any, default: str) -> str:
        value = str(raw_value or "").strip()
        return value or default

    @staticmethod
    def _read_int(raw_value: Any, default: int) -> int:
        try:
            return int(raw_value)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _read_float(raw_value: Any, default: float) -> float:
        try:
            return float(raw_value)
        except (TypeError, ValueError):
            return default
