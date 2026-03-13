from __future__ import annotations

import asyncio
import logging

from fastapi import WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from .models import ExecuteResultMessage, WSCloseCode, WSMessageType
from .registry import InstanceRegistry


REGISTER_TIMEOUT_SECONDS = 10.0

logger = logging.getLogger(__name__)


async def handle_ws_connection(
    websocket: WebSocket, registry: InstanceRegistry
) -> None:
    await websocket.accept()
    instance_id = ""
    logger.info("WebSocket accepted client=%s", websocket.client)

    try:
        try:
            first_message = await asyncio.wait_for(
                websocket.receive_json(), timeout=REGISTER_TIMEOUT_SECONDS
            )
        except asyncio.TimeoutError:
            logger.warning("Register timeout client=%s", websocket.client)
            await websocket.close(
                code=WSCloseCode.REGISTER_TIMEOUT, reason="Register timeout"
            )
            return

        if first_message.get("type") != WSMessageType.REGISTER:
            logger.warning(
                "Invalid first message client=%s payload=%s",
                websocket.client,
                first_message,
            )
            await websocket.close(
                code=WSCloseCode.REGISTER_REQUIRED,
                reason="First message must be register",
            )
            return

        instance_id = str(first_message.get("instance_id") or "").strip()
        if not instance_id:
            logger.warning(
                "Invalid instance_id client=%s payload=%s",
                websocket.client,
                first_message,
            )
            await websocket.close(
                code=WSCloseCode.REGISTER_REQUIRED, reason="Invalid instance_id"
            )
            return

        await registry.register(instance_id, websocket, first_message.get("info"))
        await websocket.send_json(
            {"type": WSMessageType.REGISTER_ACK, "instance_id": instance_id}
        )
        logger.info("Register ack sent instance_id=%s", instance_id)

        while True:
            payload = await websocket.receive_json()
            if payload.get("type") != WSMessageType.EXECUTE_RESULT:
                logger.debug(
                    "Ignore ws message instance_id=%s type=%s",
                    instance_id,
                    payload.get("type"),
                )
                continue

            try:
                result = ExecuteResultMessage.model_validate(payload)
            except ValidationError:
                logger.warning(
                    "Invalid execute_result payload instance_id=%s payload=%s",
                    instance_id,
                    payload,
                )
                continue

            await registry.handle_response(instance_id, result)

    except WebSocketDisconnect:
        logger.info(
            "WebSocket disconnected instance_id=%s client=%s",
            instance_id,
            websocket.client,
        )
    except Exception:
        logger.exception("WebSocket handler failed instance_id=%s", instance_id)
        raise
    finally:
        if instance_id:
            await registry.unregister(instance_id)
