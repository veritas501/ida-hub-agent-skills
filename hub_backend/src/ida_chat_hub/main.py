from __future__ import annotations

from pathlib import Path

import uvicorn
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import Settings
from .logger import get_logger, setup_logging
from .models import IPv4InterfaceItem
from .network import list_ipv4_interfaces, pick_default_ipv4
from .registry import InstanceRegistry
from .routes import create_api_router
from .ws_handler import handle_ws_connection


def create_app(settings: Settings | None = None) -> FastAPI:
    cfg = settings or Settings()
    setup_logging(cfg.debug)
    logger = get_logger(__name__)
    app = FastAPI(title="IDA Chat Hub", version="0.1.0")
    registry = InstanceRegistry()
    ipv4_interfaces = list_ipv4_interfaces()
    default_ip = pick_default_ipv4(ipv4_interfaces)
    interface_items = [
        IPv4InterfaceItem(
            name=item.name,
            ipv4=item.ipv4,
            is_loopback=item.is_loopback,
        )
        for item in ipv4_interfaces
    ]
    available_ips = {item.ipv4 for item in interface_items}
    available_ips.add("127.0.0.1")
    cors_origins = cfg.resolved_cors_origins()

    if cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=cors_origins,
            allow_credentials=False,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    app.include_router(
        create_api_router(registry, cfg, interface_items, available_ips, default_ip)
    )

    @app.get("/healthz", tags=["system"])
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

    @app.websocket("/ws")
    async def ws_endpoint(websocket: WebSocket) -> None:
        await handle_ws_connection(websocket, registry)

    _configure_static_routes(app, cfg)
    logger.info(
        "Hub app initialized host=%s port=%s debug=%s web_root=%s default_ip=%s ipv4_interfaces=%s",
        cfg.host,
        cfg.port,
        cfg.debug,
        cfg.resolved_web_root() or "<none>",
        default_ip,
        [f"{item.name}:{item.ipv4}" for item in interface_items],
    )
    if cors_origins:
        logger.info("CORS enabled for origins=%s", ",".join(cors_origins))
    return app


def _configure_static_routes(app: FastAPI, cfg: Settings) -> None:
    web_root = cfg.resolved_web_root()
    if web_root is None:
        @app.get("/")
        async def root_info() -> JSONResponse:
            return JSONResponse({"service": "ida-chat-hub", "docs": "/docs"})

        return

    _mount_static_subdirs(app, web_root)

    index_file = web_root / "index.html"

    @app.get("/")
    async def serve_index() -> FileResponse:
        return FileResponse(index_file)

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str) -> FileResponse:
        candidate = (web_root / full_path).resolve()
        if candidate.is_file() and _is_subpath(candidate, web_root):
            return FileResponse(candidate)

        html_candidate = (web_root / f"{full_path}.html").resolve()
        if html_candidate.is_file() and _is_subpath(html_candidate, web_root):
            return FileResponse(html_candidate)

        return FileResponse(index_file)


def _mount_static_subdirs(app: FastAPI, web_root: Path) -> None:
    next_dir = web_root / "_next"
    if next_dir.is_dir():
        app.mount("/_next", StaticFiles(directory=next_dir), name="next-static")

    assets_dir = web_root / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


def _is_subpath(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


app = create_app()


def run() -> None:
    settings = Settings()
    uvicorn.run(
        "ida_chat_hub.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )


if __name__ == "__main__":
    run()
