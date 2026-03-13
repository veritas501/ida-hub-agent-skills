from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

import httpx
import uvicorn
from fastapi import FastAPI, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from . import __version__
from .config import Settings
from .logger import get_logger, setup_logging
from .models import IPv4InterfaceItem
from .network import list_ipv4_interfaces, pick_default_ipv4
from .registry import InstanceRegistry
from .routes import create_api_router
from .ws_handler import handle_ws_connection

# Hop-by-hop headers that should not be forwarded in proxy responses
PROXY_EXCLUDED_HEADERS = frozenset({"content-encoding", "transfer-encoding", "connection"})


@asynccontextmanager
async def _dev_proxy_lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Lifespan context manager for dev proxy mode."""
    app.state.proxy_client = httpx.AsyncClient(timeout=30.0)
    try:
        yield
    finally:
        await app.state.proxy_client.aclose()


def create_app(settings: Settings | None = None) -> FastAPI:
    cfg = settings or Settings()
    setup_logging(cfg.debug)
    logger = get_logger(__name__)

    # Use lifespan only in dev mode for proxy client management
    lifespan = _dev_proxy_lifespan if cfg.dev_mode else None
    app = FastAPI(title="IDA Chat Hub", version=__version__, lifespan=lifespan)
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
    logger = get_logger(__name__)

    # Development mode: proxy to Next.js dev server
    if cfg.dev_mode:
        logger.info("Dev mode enabled: proxying frontend to %s", cfg.dev_proxy_url)
        _setup_dev_proxy(app, cfg)
        return

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


def _setup_dev_proxy(app: FastAPI, cfg: Settings) -> None:
    """Setup proxy routes for Next.js dev server in development mode."""
    proxy_url = cfg.dev_proxy_url

    @app.get("/")
    async def proxy_root(request: Request) -> Response:
        return await _proxy_request(request, proxy_url, "")

    @app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
    async def proxy_path(request: Request, full_path: str) -> Response:
        return await _proxy_request(request, proxy_url, full_path)


async def _proxy_request(request: Request, base_url: str, path: str) -> Response:
    """Proxy a request to the target URL using shared client."""
    url = f"{base_url}/{path}"
    if request.url.query:
        url += f"?{request.url.query}"

    headers = dict(request.headers)
    # Remove host header to avoid conflicts
    headers.pop("host", None)

    client: httpx.AsyncClient = request.app.state.proxy_client
    try:
        response = await client.request(
            method=request.method,
            url=url,
            headers=headers,
            content=await request.body(),
        )

        # Filter out hop-by-hop headers
        response_headers = {
            k: v for k, v in response.headers.items()
            if k.lower() not in PROXY_EXCLUDED_HEADERS
        }

        return Response(
            content=response.content,
            status_code=response.status_code,
            headers=response_headers,
            media_type=response.headers.get("content-type"),
        )
    except httpx.ConnectError:
        return JSONResponse(
            {"error": f"Cannot connect to dev server at {base_url}. Is Next.js running?"},
            status_code=502,
        )
    except httpx.RequestError as e:
        return JSONResponse(
            {"error": f"Proxy error: {str(e)}"},
            status_code=502,
        )


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
