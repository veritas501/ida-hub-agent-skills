from __future__ import annotations

import asyncio
import logging
import uuid

from fastapi import APIRouter, HTTPException, Query

from .config import Settings
from .models import (
    ConfigResponse,
    ExecuteRequest,
    ExecuteResponse,
    InstanceInfo,
    IPv4InterfaceItem,
    NetworkInterfacesResponse,
)
from .registry import InstanceRegistry

logger = logging.getLogger(__name__)


def create_api_router(
    registry: InstanceRegistry,
    settings: Settings,
    interfaces: list[IPv4InterfaceItem],
    available_ips: set[str],
    default_ip: str,
) -> APIRouter:
    router = APIRouter(prefix="/api", tags=["hub"])

    @router.get("/instances", response_model=list[InstanceInfo])
    async def list_instances() -> list[InstanceInfo]:
        instances = await registry.list_all()
        logger.info("List instances count=%s", len(instances))
        return instances

    @router.get("/network/interfaces", response_model=NetworkInterfacesResponse)
    async def list_network_interfaces() -> NetworkInterfacesResponse:
        logger.info(
            "List network interfaces count=%s default_ip=%s",
            len(interfaces),
            default_ip,
        )
        return NetworkInterfacesResponse(interfaces=interfaces, default_ip=default_ip)

    @router.post("/execute", response_model=ExecuteResponse)
    async def execute_code(payload: ExecuteRequest) -> ExecuteResponse:
        request_id = uuid.uuid4().hex
        logger.info(
            "Execute requested instance_id=%s request_id=%s code_len=%s",
            payload.instance_id,
            request_id,
            len(payload.code),
        )

        try:
            result = await registry.execute_code(
                instance_id=payload.instance_id,
                code=payload.code,
                request_id=request_id,
                timeout=settings.execute_timeout,
            )
        except KeyError as exc:
            logger.warning(
                "Execute rejected missing instance instance_id=%s request_id=%s",
                payload.instance_id,
                request_id,
            )
            raise HTTPException(
                status_code=404, detail=f"Instance not found: {exc.args[0]}"
            )
        except (TimeoutError, asyncio.TimeoutError):
            logger.warning(
                "Execute timeout instance_id=%s request_id=%s",
                payload.instance_id,
                request_id,
            )
            raise HTTPException(status_code=504, detail="Execute timed out")
        except ConnectionError as exc:
            logger.warning(
                "Execute connection error instance_id=%s request_id=%s error=%s",
                payload.instance_id,
                request_id,
                exc,
            )
            raise HTTPException(status_code=503, detail=str(exc))
        except Exception as exc:
            logger.exception(
                "Execute failed instance_id=%s request_id=%s",
                payload.instance_id,
                request_id,
            )
            raise HTTPException(status_code=500, detail=f"Execute failed: {exc}")

        logger.info(
            "Execute completed instance_id=%s request_id=%s success=%s",
            payload.instance_id,
            request_id,
            result.success,
        )
        return ExecuteResponse(
            success=result.success,
            output=result.output,
            error=result.error,
            request_id=request_id,
        )

    @router.get("/config", response_model=ConfigResponse)
    async def get_config(
        ip: str | None = Query(default=None, description="Hub host IP"),
    ) -> ConfigResponse:
        selected_ip = ip if ip else default_ip
        if selected_ip not in available_ips:
            logger.warning("Get config invalid ip=%s", selected_ip)
            raise HTTPException(status_code=400, detail=f"Invalid ip: {selected_ip}")

        hub_url = f"http://{selected_ip}:{settings.port}"
        logger.info("Get config selected_ip=%s port=%s", selected_ip, settings.port)
        example_instance = "a1b2c3d4"
        markdown = (
            "# List instances\n"
            f"curl {hub_url}/api/instances\n\n"
            "# Execute code\n"
            "curl -X POST "
            f"{hub_url}/api/execute "
            "-H 'Content-Type: application/json' "
            f'-d \'{{"instance_id": "{example_instance}", "code": "print(42)"}}\'\n\n'
            "# Python helper\n"
            "import requests\n\n"
            f"BASE = '{hub_url}'\n"
            "resp = requests.get(f'{BASE}/api/instances', timeout=5)\n"
            "print(resp.json())\n"
        )

        return ConfigResponse(
            result=markdown,
            selected_ip=selected_ip,
            port=settings.port,
        )

    return router
