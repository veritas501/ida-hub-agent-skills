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


def _build_config_markdown(hub_url: str, example_instance: str) -> str:
    """Build the Markdown configuration guide for /api/config."""

    return (
        "# IDA Hub — Recommended Setup\n\n"
        "## Python Helper (Recommended)\n\n"
        "Save this as a local script and adjust `BASE_URL` / `INSTANCE_ID`.\n\n"
        "```python\n"
        "import textwrap\n\n"
        "import requests\n\n"
        f'BASE_URL = "{hub_url}"\n'
        'INSTANCE_ID = "replace-me"  # Get from list_instances()\n\n\n'
        "def list_instances(timeout=10):\n"
        f'    resp = requests.get(f"{{BASE_URL}}/api/instances", timeout=timeout)\n'
        "    resp.raise_for_status()\n"
        "    return resp.json()\n\n\n"
        "def execute(code, timeout=30):\n"
        "    resp = requests.post(\n"
        f'        f"{{BASE_URL}}/api/execute",\n'
        '        json={"instance_id": INSTANCE_ID, "code": textwrap.dedent(code).strip()},\n'
        "        timeout=timeout,\n"
        "    )\n"
        "    resp.raise_for_status()\n"
        "    data = resp.json()\n"
        '    if not data["success"]:\n'
        '        raise RuntimeError(data.get("error") or "Execution failed")\n'
        '    return data["output"]\n'
        "```\n\n"
        "### Usage Example\n\n"
        "```python\n"
        "# 1. List instances\n"
        "print(list_instances())\n\n"
        "# 2. Execute analysis script\n"
        'report = execute("""\n'
        "    import json\n"
        "    funcs = []\n"
        "    for func in db.functions:\n"
        "        name = db.functions.get_name(func)\n"
        '        funcs.append({"name": name, "start": f"0x{func.start_ea:08X}"})\n'
        '    print(json.dumps({"total": len(funcs), "top": funcs[:10]}, indent=2))\n'
        '""")\n'
        "print(report)\n"
        "```\n\n"
        "## Quick Check (curl fallback)\n\n"
        "```bash\n"
        "# List instances\n"
        f"curl -s {hub_url}/api/instances\n\n"
        "# Execute code\n"
        f"curl -s -X POST {hub_url}/api/execute \\\n"
        "  -H 'Content-Type: application/json' \\\n"
        f"  -d '{{\"instance_id\": \"{example_instance}\", \"code\": \"print(42)\"}}'\n"
        "```\n\n"
        "## Instances\n\n"
        f"[View connected instances]({hub_url}/api/instances)\n"
    )


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
        markdown = _build_config_markdown(hub_url, example_instance="a1b2c3d4")

        return ConfigResponse(
            result=markdown,
            selected_ip=selected_ip,
            port=settings.port,
        )

    return router
