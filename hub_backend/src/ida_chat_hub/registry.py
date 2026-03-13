from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket

from .models import (
    ExecuteResultMessage,
    InstanceInfo,
    InstanceMeta,
    WSCloseCode,
    WSMessageType,
)

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class ConnectedInstance:
    instance_id: str
    websocket: WebSocket
    info: InstanceMeta
    connected_at: datetime


class InstanceRegistry:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._instances: dict[str, ConnectedInstance] = {}
        self._pending: dict[tuple[str, str], asyncio.Future[ExecuteResultMessage]] = {}

    async def register(
        self, instance_id: str, websocket: WebSocket, info: dict[str, Any] | None
    ) -> None:
        async with self._lock:
            old = self._instances.get(instance_id)
            self._instances[instance_id] = ConnectedInstance(
                instance_id=instance_id,
                websocket=websocket,
                info=InstanceMeta.model_validate(info or {}),
                connected_at=datetime.now(timezone.utc),
            )

        if old is not None and old.websocket is not websocket:
            logger.warning("Instance replaced instance_id=%s", instance_id)
            await old.websocket.close(
                code=WSCloseCode.REPLACED, reason="Replaced by newer session"
            )
        logger.info("Instance registered instance_id=%s", instance_id)

    async def unregister(self, instance_id: str) -> None:
        async with self._lock:
            self._instances.pop(instance_id, None)
            pending_keys = [k for k in self._pending if k[0] == instance_id]
            for key in pending_keys:
                future = self._pending.pop(key)
                if not future.done():
                    future.set_exception(ConnectionError("Instance disconnected"))
        logger.info("Instance unregistered instance_id=%s", instance_id)

    async def get(self, instance_id: str) -> ConnectedInstance | None:
        async with self._lock:
            return self._instances.get(instance_id)

    async def list_all(self) -> list[InstanceInfo]:
        async with self._lock:
            return [
                InstanceInfo(
                    instance_id=item.instance_id,
                    module=item.info.module,
                    db_path=item.info.db_path,
                    architecture=item.info.architecture,
                    platform=item.info.platform,
                    connected_at=item.connected_at,
                )
                for item in self._instances.values()
            ]

    async def execute_code(
        self,
        instance_id: str,
        code: str,
        request_id: str,
        timeout: float,
    ) -> ExecuteResultMessage:
        async with self._lock:
            target = self._instances.get(instance_id)
            if target is None:
                raise KeyError(instance_id)

            pending_key = (instance_id, request_id)
            loop = asyncio.get_running_loop()
            future: asyncio.Future[ExecuteResultMessage] = loop.create_future()
            self._pending[pending_key] = future

        try:
            logger.info(
                "Dispatch execute instance_id=%s request_id=%s", instance_id, request_id
            )
            await target.websocket.send_json(
                {
                    "type": WSMessageType.EXECUTE,
                    "request_id": request_id,
                    "code": code,
                }
            )
        except Exception:
            async with self._lock:
                self._pending.pop((instance_id, request_id), None)
            logger.exception(
                "Dispatch execute failed instance_id=%s request_id=%s",
                instance_id,
                request_id,
            )
            raise

        try:
            return await asyncio.wait_for(future, timeout=timeout)
        except asyncio.TimeoutError:
            logger.warning(
                "Execute timeout instance_id=%s request_id=%s timeout=%s",
                instance_id,
                request_id,
                timeout,
            )
            raise
        finally:
            async with self._lock:
                self._pending.pop((instance_id, request_id), None)

    async def handle_response(
        self, instance_id: str, result: ExecuteResultMessage
    ) -> bool:
        async with self._lock:
            pending_key = (instance_id, result.request_id)
            future = self._pending.get(pending_key)
            if future is None or future.done():
                logger.warning(
                    "Execute response dropped instance_id=%s request_id=%s",
                    instance_id,
                    result.request_id,
                )
                return False
            future.set_result(result)
            logger.info(
                "Execute response received instance_id=%s request_id=%s success=%s",
                instance_id,
                result.request_id,
                result.success,
            )
            return True
