"""Helpers for encoding and decoding idahub:// plugin config strings."""

from __future__ import annotations

import base64
import json
from typing import Any


IDA_CONFIG_SCHEME = "idahub://"
IDA_CONFIG_VERSION = 2


class IDAConfigError(ValueError):
    """Raised when an IDA Hub config string is missing or malformed."""


def encode_ida_config(*, host: str, port: int, token: str) -> str:
    """Encode host/port/token into a compact idahub:// config string."""

    payload = {
        "version": IDA_CONFIG_VERSION,
        "host": host,
        "port": port,
        "token": token,
    }
    raw = json.dumps(
        payload,
        ensure_ascii=True,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    encoded = base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
    return f"{IDA_CONFIG_SCHEME}{encoded}"


def decode_ida_config(config_string: str) -> dict[str, Any]:
    """Decode and validate an idahub:// config string."""

    text = str(config_string or "").strip()
    if not text:
        raise IDAConfigError("IDA config string is empty.")
    if not text.startswith(IDA_CONFIG_SCHEME):
        raise IDAConfigError("IDA config must start with idahub://")

    encoded = text[len(IDA_CONFIG_SCHEME) :].strip()
    if not encoded:
        raise IDAConfigError("IDA config payload is empty.")

    padding = "=" * (-len(encoded) % 4)
    try:
        raw = base64.urlsafe_b64decode((encoded + padding).encode("ascii"))
    except Exception as exc:
        raise IDAConfigError(f"IDA config base64 is invalid: {exc}") from exc

    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception as exc:
        raise IDAConfigError(f"IDA config JSON is invalid: {exc}") from exc

    if not isinstance(payload, dict):
        raise IDAConfigError("IDA config payload must be a JSON object.")

    version = payload.get("version")
    if version == 1:
        raise IDAConfigError(
            "Config version 1 is no longer supported, please get a new config string from Hub Web UI"
        )
    if version != IDA_CONFIG_VERSION:
        raise IDAConfigError(f"Unsupported IDA config version: {version}")

    host = str(payload.get("host") or "").strip()
    if not host:
        raise IDAConfigError("IDA config host is missing.")

    try:
        port = int(payload.get("port"))
    except (TypeError, ValueError) as exc:
        raise IDAConfigError("IDA config port is invalid.") from exc

    if port <= 0 or port > 65535:
        raise IDAConfigError("IDA config port must be between 1 and 65535.")

    token = str(payload.get("token") or "").strip()
    if not token:
        raise IDAConfigError("IDA config token is missing.")

    return {
        "version": version,
        "host": host,
        "port": port,
        "token": token,
    }
