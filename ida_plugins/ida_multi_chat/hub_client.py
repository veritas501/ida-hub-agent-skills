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
import idc  # type: ignore
import websocket  # type: ignore

from .core import ExecutionResult, ScriptExecutor

logging.getLogger("websocket").setLevel(logging.CRITICAL)


@dataclass(frozen=True)
class HubConfig:
    host: str = "127.0.0.1"
    port: int = 10086
    reconnect_interval: float = 5.0


StatusCallback = Callable[[str, str], None]


class IDAHubClient:
    STATE_DISCONNECTED = "disconnected"
    STATE_CONNECTING = "connecting"
    STATE_CONNECTED = "connected"

    def __init__(
        self,
        config: HubConfig,
        script_executor: ScriptExecutor | None = None,
        status_callback: StatusCallback | None = None,
    ) -> None:
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

    @property
    def instance_id(self) -> str:
        return self._instance_id

    @property
    def state(self) -> str:
        with self._lock:
            return self._state

    def is_connected(self) -> bool:
        return self.state == self.STATE_CONNECTED

    def is_connecting(self) -> bool:
        return self.state == self.STATE_CONNECTING

    def update_config(self, config: HubConfig) -> None:
        with self._lock:
            self._config = config

    def connect(self) -> bool:
        with self._lock:
            if self._state in {self.STATE_CONNECTING, self.STATE_CONNECTED}:
                return False

            self._manual_disconnect = False
            self._last_error = ""
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
        return f"ws://{self._config.host}:{self._config.port}/ws"

    def _generate_instance_id(self) -> str:
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
        self._last_error = ""
        payload = {
            "type": "register",
            "instance_id": self._instance_id,
            "info": self._get_instance_info(),
        }
        self._send_json(payload, ws_app=ws_app)
        self._start_register_timer(ws_app)

    def _on_message(self, _ws_app: Any, message: str) -> None:
        try:
            payload = json.loads(message)
        except ValueError:
            self._last_error = f"Received invalid JSON message: {message}"
            return

        message_type = payload.get("type")
        if message_type == "register_ack":
            self._registered_event.set()
            self._cancel_register_timer()
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
        text = str(error)
        if "opcode=8" in text and "Register timeout" in text:
            return
        self._last_error = f"WebSocket error: {text}"

    def _on_close(self, _ws_app: Any, status_code: Any, message: Any) -> None:
        if self._manual_disconnect:
            return

        suffix = ""
        if status_code is not None:
            suffix = f" (code={status_code}, message={message})"
        if not self._last_error:
            self._last_error = f"WebSocket closed{suffix}"

    def _handle_execute(self, payload: dict[str, Any]) -> None:
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
        if self._script_executor is None:
            return ExecutionResult(
                success=False, error="Script executor is not configured."
            )

        try:
            return self._script_executor(code)
        except Exception:
            return ExecutionResult(success=False, error=traceback.format_exc())

    def _send_json(self, payload: dict[str, Any], ws_app: Any | None = None) -> None:
        message = json.dumps(payload, ensure_ascii=True)
        target = ws_app
        if target is None:
            with self._lock:
                target = self._ws_app

        if target is None:
            raise RuntimeError("WebSocket connection is not established.")
        target.send(message)

    def _get_instance_info(self) -> dict[str, str]:
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
    def _first_non_empty(*values: Any) -> str:
        for value in values:
            if value is None:
                continue
            text = str(value).strip()
            if text:
                return text
        return ""

    @staticmethod
    def _call_ida(callback: Callable[[], Any]) -> Any:
        try:
            return callback()
        except Exception:
            return None

    @staticmethod
    def _get_idb_path() -> str:
        if hasattr(idc, "get_idb_path"):
            return str(idc.get_idb_path())
        if hasattr(idaapi, "get_path") and hasattr(idaapi, "PATH_TYPE_IDB"):
            return str(idaapi.get_path(idaapi.PATH_TYPE_IDB))
        return ""

    @staticmethod
    def _get_architecture() -> str:
        if not hasattr(idaapi, "get_inf_structure"):
            return ""

        info = idaapi.get_inf_structure()
        procname = str(getattr(info, "procname", "") or "")
        if hasattr(info, "is_64bit") and info.is_64bit():
            return f"{procname}_64" if procname else "64bit"
        if hasattr(info, "is_32bit") and info.is_32bit():
            return procname or "32bit"
        return procname

    def _start_register_timer(self, ws_app: Any) -> None:
        def on_timeout() -> None:
            if self._registered_event.is_set() or self._stop_event.is_set():
                return
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
        with self._lock:
            self._cancel_register_timer_locked()

    def _cancel_register_timer_locked(self) -> None:
        if self._register_timer is None:
            return
        self._register_timer.cancel()
        self._register_timer = None

    def _set_state(self, state: str, message: str) -> None:
        with self._lock:
            self._set_state_locked(state, message)

    def _set_state_locked(self, state: str, message: str) -> None:
        self._state = state
        if self._status_callback is not None:
            self._status_callback(state, message)
