"""WebSocket client that bridges IDA instance and Hub server."""

from __future__ import annotations

import json
import logging
import os
import platform
import random
import threading
import traceback
from dataclasses import dataclass
from typing import Any, Callable

import idaapi  # type: ignore
import ida_kernwin  # type: ignore
import idc  # type: ignore
import websocket  # type: ignore

from .core import ExecutionResult, ScriptExecutor

logging.getLogger("websocket").setLevel(logging.CRITICAL)


@dataclass(frozen=True)
class HubConfig:
    """Connection settings for Hub server."""

    host: str = "127.0.0.1"
    port: int = 10086
    reconnect_interval: float = 5.0
    auto_connect: bool = False


StatusCallback = Callable[[str, str], None]


class IDAHubClient:
    """Manage Hub connection, registration, and remote execution flow."""

    STATE_DISCONNECTED = "disconnected"
    STATE_CONNECTING = "connecting"
    STATE_CONNECTED = "connected"

    def __init__(
        self,
        config: HubConfig,
        script_executor: ScriptExecutor | None = None,
        status_callback: StatusCallback | None = None,
    ) -> None:
        """Initialize client state and threading primitives."""

        self._config = config
        self._script_executor = script_executor
        self._status_callback = status_callback
        self._instance_id = self._generate_instance_id()
        self._lock = threading.RLock()
        self._stop_event = threading.Event()
        self._registered_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._ws_app: Any = None
        self._register_timer: threading.Timer | None = None
        self._manual_disconnect = False
        self._state = self.STATE_DISCONNECTED
        self._last_error = ""
        self._retry_on_initial_failure = True
        self._has_ever_connected = False

    @property
    def instance_id(self) -> str:
        """Return current instance identifier."""

        return self._instance_id

    @property
    def state(self) -> str:
        """Return current connection state."""

        with self._lock:
            return self._state

    def is_connected(self) -> bool:
        """Return True when websocket is registered and connected."""

        return self.state == self.STATE_CONNECTED

    def is_connecting(self) -> bool:
        """Return True while initial connection/registration is ongoing."""

        return self.state == self.STATE_CONNECTING

    def update_config(self, config: HubConfig) -> None:
        """Update runtime config for subsequent reconnect attempts."""

        with self._lock:
            self._config = config

    def connect(self, retry_on_initial_failure: bool = True) -> bool:
        """Start background websocket loop.

        Returns False when already connecting/connected.
        """

        with self._lock:
            if self._state in {self.STATE_CONNECTING, self.STATE_CONNECTED}:
                return False

            self._manual_disconnect = False
            self._last_error = ""
            self._retry_on_initial_failure = retry_on_initial_failure
            self._has_ever_connected = False
            self._stop_event.clear()
            self._registered_event.clear()
            self._set_state_locked(
                self.STATE_CONNECTING, f"Connecting to {self._build_ws_url()}"
            )
            self._thread = threading.Thread(
                target=self._run_forever,
                name="ida-hub-client",
                daemon=True,
            )
            self._thread.start()
            return True

    def disconnect(self) -> bool:
        """Stop client loop and close websocket connection."""

        with self._lock:
            if self._state == self.STATE_DISCONNECTED and self._thread is None:
                return False

            self._manual_disconnect = True
            self._stop_event.set()
            self._cancel_register_timer_locked()
            ws_app = self._ws_app
            thread = self._thread

        if ws_app is not None:
            try:
                ws_app.close()
            except Exception:
                pass

        if (
            thread is not None
            and thread.is_alive()
            and thread is not threading.current_thread()
        ):
            thread.join(timeout=2.0)

        with self._lock:
            self._thread = None
            self._ws_app = None
            self._set_state_locked(self.STATE_DISCONNECTED, "Disconnected from Hub")
        return True

    def _run_forever(self) -> None:
        """Run websocket loop with reconnect policy."""

        while not self._stop_event.is_set():
            self._registered_event.clear()
            self._cancel_register_timer()
            url = self._build_ws_url()
            ws_app = websocket.WebSocketApp(  # type: ignore[union-attr]
                url,
                on_open=self._on_open,
                on_message=self._on_message,
                on_error=self._on_error,
                on_close=self._on_close,
            )

            with self._lock:
                self._ws_app = ws_app

            try:
                ws_app.run_forever(ping_interval=30, ping_timeout=10)
            except Exception:
                self._last_error = traceback.format_exc()
            finally:
                self._cancel_register_timer()
                with self._lock:
                    self._ws_app = None

            if self._stop_event.is_set() or self._manual_disconnect:
                break

            if not self._retry_on_initial_failure and not self._has_ever_connected:
                self._set_state(
                    self.STATE_DISCONNECTED,
                    self._last_error or "Initial connection failed",
                )
                break

            message = (
                f"{self._last_error}; retrying in {self._config.reconnect_interval:g}s"
                if self._last_error
                else f"Connection closed, retrying in {self._config.reconnect_interval:g}s"
            )
            self._set_state(self.STATE_DISCONNECTED, message)
            self._stop_event.wait(self._config.reconnect_interval)
            if not self._stop_event.is_set():
                self._set_state(self.STATE_CONNECTING, "")

        with self._lock:
            self._thread = None
            if self._manual_disconnect:
                self._set_state_locked(self.STATE_DISCONNECTED, "Disconnected from Hub")
            elif self._state != self.STATE_CONNECTED:
                self._set_state_locked(
                    self.STATE_DISCONNECTED, self._last_error or "Connection closed"
                )

    def _build_ws_url(self) -> str:
        """Build websocket URL from current config."""

        return f"ws://{self._config.host}:{self._config.port}/ws"

    def _generate_instance_id(self) -> str:
        """Generate a stable-readable instance ID with random suffix."""

        filename = self._first_non_empty(
            self._call_ida(lambda: idaapi.get_root_filename()),
            self._call_ida(lambda: idc.get_root_filename()),
            "ida",
        )
        stem = os.path.splitext(os.path.basename(filename))[0].strip() or "ida"
        normalized = "".join(
            char if (char.isalnum() or char in {"_", "-"}) else "_" for char in stem
        )
        base = normalized[:24] or "ida"
        suffix = f"{random.randint(0, 999):03d}"
        return f"{base}_{suffix}"

    def _on_open(self, ws_app: Any) -> None:
        """Send register message immediately after websocket opens."""

        self._last_error = ""
        payload = {
            "type": "register",
            "instance_id": self._instance_id,
            "info": self._get_instance_info(),
        }
        self._send_json(payload, ws_app=ws_app)
        self._start_register_timer(ws_app)

    def _on_message(self, _ws_app: Any, message: str) -> None:
        """Handle register ack and execute messages from Hub."""

        try:
            payload = json.loads(message)
        except ValueError:
            self._last_error = f"Received invalid JSON message: {message}"
            return

        message_type = payload.get("type")
        if message_type == "register_ack":
            self._registered_event.set()
            self._cancel_register_timer()
            self._has_ever_connected = True
            instance_id = payload.get("instance_id")
            if isinstance(instance_id, str) and instance_id:
                self._instance_id = instance_id
            self._set_state(
                self.STATE_CONNECTED,
                f"Connected to Hub, instance ID: {self._instance_id}",
            )
            return

        if message_type == "execute":
            threading.Thread(
                target=self._handle_execute,
                args=(payload,),
                name="ida-hub-execute",
                daemon=True,
            ).start()
            return

    def _on_error(self, _ws_app: Any, error: Any) -> None:
        """Capture websocket errors for status reporting/retry logs."""

        text = str(error)
        if "opcode=8" in text and "Register timeout" in text:
            return
        self._last_error = f"WebSocket error: {text}"

    def _on_close(self, _ws_app: Any, status_code: Any, message: Any) -> None:
        """Record close reason unless disconnect was requested manually."""

        if self._manual_disconnect:
            return

        suffix = ""
        if status_code is not None:
            suffix = f" (code={status_code}, message={message})"
        if not self._last_error:
            self._last_error = f"WebSocket closed{suffix}"

    def _handle_execute(self, payload: dict[str, Any]) -> None:
        """Execute requested code and send execute_result back to Hub."""

        request_id = str(payload.get("request_id") or "")
        code = payload.get("code")
        if not request_id or not isinstance(code, str):
            return

        result = self._execute_code(code)
        response = {
            "type": "execute_result",
            "request_id": request_id,
            "success": result.success,
            "output": result.output,
            "error": result.error,
        }

        try:
            self._send_json(response)
        except Exception:
            self._last_error = traceback.format_exc()
            self._set_state(self.STATE_DISCONNECTED, self._last_error)

    def _execute_code(self, code: str) -> ExecutionResult:
        """Delegate code execution to injected executor."""

        if self._script_executor is None:
            return ExecutionResult(
                success=False, error="Script executor is not configured."
            )

        try:
            return self._script_executor(code)
        except Exception:
            return ExecutionResult(success=False, error=traceback.format_exc())

    def _send_json(self, payload: dict[str, Any], ws_app: Any | None = None) -> None:
        """Serialize and send JSON payload through active websocket."""

        message = json.dumps(payload, ensure_ascii=True)
        target = ws_app
        if target is None:
            with self._lock:
                target = self._ws_app

        if target is None:
            raise RuntimeError("WebSocket connection is not established.")
        target.send(message)

    def _get_instance_info(self) -> dict[str, str]:
        """Collect instance metadata for register message."""

        info = self._run_in_main_thread(self._collect_instance_info_main_thread)
        if isinstance(info, dict):
            return info

        return {
            "module": "unknown",
            "db_path": "",
            "architecture": "unknown",
            "platform": platform.system().lower(),
        }

    def _collect_instance_info_main_thread(self) -> dict[str, str]:
        """Collect IDA metadata in main thread to avoid API thread issues."""

        module = self._first_non_empty(
            self._call_ida(lambda: idaapi.get_root_filename()),
            self._call_ida(lambda: idc.get_root_filename()),
            "unknown",
        )
        db_path = self._first_non_empty(
            self._call_ida(self._get_idb_path),
            "",
        )
        architecture = self._first_non_empty(
            self._call_ida(self._get_architecture),
            "unknown",
        )

        return {
            "module": module,
            "db_path": db_path,
            "architecture": architecture,
            "platform": platform.system().lower(),
        }

    @staticmethod
    def _run_in_main_thread(callback: Callable[[], Any]) -> Any:
        """Run callback in IDA main thread when execute_sync is available."""

        execute_sync = getattr(ida_kernwin, "execute_sync", None)
        if not callable(execute_sync):
            return callback()

        holder: dict[str, Any] = {"value": None}

        def run() -> int:
            holder["value"] = callback()
            return 1

        try:
            execute_sync(run, getattr(ida_kernwin, "MFF_FAST", 0))
        except Exception:
            return None
        return holder.get("value")

    @staticmethod
    def _first_non_empty(*values: Any) -> str:
        """Return first non-empty value converted to stripped string."""

        for value in values:
            if value is None:
                continue
            text = str(value).strip()
            if text:
                return text
        return ""

    @staticmethod
    def _call_ida(callback: Callable[[], Any]) -> Any:
        """Call an IDA API callback and suppress exceptions."""

        try:
            return callback()
        except Exception:
            return None

    @staticmethod
    def _get_idb_path() -> str:
        """Read current IDB path with API compatibility fallback."""

        if hasattr(idc, "get_idb_path"):
            return str(idc.get_idb_path())
        if hasattr(idaapi, "get_path") and hasattr(idaapi, "PATH_TYPE_IDB"):
            return str(idaapi.get_path(idaapi.PATH_TYPE_IDB))
        return ""

    @staticmethod
    def _get_architecture() -> str:
        """Best-effort architecture string across old/new IDA APIs."""

        procname = ""
        if hasattr(idc, "inf_get_procname"):
            try:
                procname = str(idc.inf_get_procname() or "").strip()
            except Exception:
                procname = ""

        if not procname and hasattr(idc, "get_inf_attr") and hasattr(idc, "INF_PROCNAME"):
            try:
                procname = str(idc.get_inf_attr(idc.INF_PROCNAME) or "").strip()
            except Exception:
                procname = ""

        info = None
        if not procname and hasattr(idaapi, "get_inf_structure"):
            try:
                info = idaapi.get_inf_structure()
                procname = str(getattr(info, "procname", "") or "").strip()
            except Exception:
                info = None
                procname = ""

        is_64bit: bool | None = None
        if hasattr(idc, "__EA64__"):
            try:
                is_64bit = bool(idc.__EA64__)
            except Exception:
                is_64bit = None

        if (
            is_64bit is None
            and hasattr(idc, "get_inf_attr")
            and hasattr(idc, "INF_LFLAGS")
            and hasattr(idc, "LFLG_64BIT")
        ):
            try:
                lflags = int(idc.get_inf_attr(idc.INF_LFLAGS))
                is_64bit = bool(lflags & int(idc.LFLG_64BIT))
            except Exception:
                is_64bit = None

        if is_64bit is None and info is not None:
            try:
                if hasattr(info, "is_64bit"):
                    is_64bit = bool(info.is_64bit())
                elif hasattr(info, "is_32bit"):
                    is_64bit = not bool(info.is_32bit())
            except Exception:
                is_64bit = None

        normalized = procname.lower()
        if normalized == "metapc":
            return "x86_64" if is_64bit else "x86"
        if normalized == "arm":
            return "aarch64" if is_64bit else "arm"
        if normalized:
            return f"{normalized}_64" if is_64bit else normalized
        if is_64bit is True:
            return "64bit"
        return ""

    def _start_register_timer(self, ws_app: Any) -> None:
        """Start timeout guard for register_ack."""

        def on_timeout() -> None:
            if self._registered_event.is_set() or self._stop_event.is_set():
                return
            # 注册超时后主动关闭连接，交由外层重连策略处理.
            self._last_error = "Registration timed out, reconnecting."
            try:
                ws_app.close()
            except Exception:
                pass

        with self._lock:
            self._cancel_register_timer_locked()
            self._register_timer = threading.Timer(10.0, on_timeout)
            self._register_timer.daemon = True
            self._register_timer.start()

    def _cancel_register_timer(self) -> None:
        """Cancel register timeout timer safely."""

        with self._lock:
            self._cancel_register_timer_locked()

    def _cancel_register_timer_locked(self) -> None:
        """Cancel register timer under lock."""

        if self._register_timer is None:
            return
        self._register_timer.cancel()
        self._register_timer = None

    def _set_state(self, state: str, message: str) -> None:
        """Set state with lock protection."""

        with self._lock:
            self._set_state_locked(state, message)

    def _set_state_locked(self, state: str, message: str) -> None:
        """Set state and notify status callback.

        Caller must hold ``self._lock``.
        """

        self._state = state
        if self._status_callback is not None:
            self._status_callback(state, message)
