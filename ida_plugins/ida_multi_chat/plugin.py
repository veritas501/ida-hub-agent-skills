"""IDA plugin UI layer for IDA Multi Chat."""

from __future__ import annotations

from datetime import datetime
from dataclasses import dataclass

import idaapi  # type: ignore
import ida_kernwin  # type: ignore

from .config_persistence import HubConfigPersistence
from .core import IDAScriptExecutor
from .hub_client import HubConfig, IDAHubClient


class HubSettingsForm(ida_kernwin.Form):  # type: ignore[misc]
    """Settings dialog for Hub connection options."""

    def __init__(self, config: HubConfig) -> None:
        self._initial_config = config
        super().__init__(
            r"""STARTITEM 0
BUTTON YES* Save
BUTTON CANCEL Cancel
Hub Settings

<Host        :{host}>
<Port        :{port}>

Advanced Settings

<Reconnect   :{reconnect}> seconds
<Auto Connect:{auto_connect_enabled}>{auto_connect_group}>
""",
            {
                "host": ida_kernwin.Form.StringInput(swidth=40),
                "port": ida_kernwin.Form.StringInput(swidth=16),
                "reconnect": ida_kernwin.Form.StringInput(swidth=16),
                "auto_connect_group": ida_kernwin.Form.ChkGroupControl(
                    ("auto_connect_enabled",)
                ),
            },
        )

    def prompt(self) -> HubConfig | None:
        """Show dialog and return updated config, or None if canceled."""

        self.Compile()
        self.host.value = self._initial_config.host
        self.port.value = str(self._initial_config.port)
        self.reconnect.value = str(self._initial_config.reconnect_interval)
        self.auto_connect_enabled.checked = self._initial_config.auto_connect

        try:
            ok = self.Execute()
            if ok != 1:
                return None

            host = str(self.host.value or "").strip() or self._initial_config.host
            port = int(str(self.port.value or "").strip())
            reconnect = float(str(self.reconnect.value or "").strip())
            auto_connect = bool(self.auto_connect_enabled.checked)
            return HubConfig(
                host=host,
                port=port,
                reconnect_interval=reconnect,
                auto_connect=auto_connect,
            )
        finally:
            self.Free()


@dataclass(frozen=True)
class PluginAction:
    """Static metadata for one IDA menu action."""

    name: str
    label: str
    tooltip: str
    menu_path: str


class MenuActionHandler(idaapi.action_handler_t):
    """Bridge IDA action callbacks to plugin methods."""

    def __init__(self, plugin: "IDAMultiChatPlugin", action_name: str) -> None:
        super().__init__()
        self._plugin = plugin
        self._action_name = action_name

    def activate(self, _ctx) -> int:
        """Handle menu activation."""

        self._plugin.handle_action(self._action_name)
        return 1

    def update(self, _ctx) -> int:
        """Return current action enable/disable state."""

        return self._plugin.get_action_state(self._action_name)


class IDAMultiChatPlugin(idaapi.plugin_t):
    """Main IDA plugin implementation."""

    flags = idaapi.PLUGIN_KEEP | getattr(idaapi, "PLUGIN_HIDE", 0)
    comment = "IDA Multi Chat Hub plugin"
    help = "Connect to a Hub Server and execute remote scripts"
    wanted_name = "IDA Multi Chat"
    wanted_hotkey = ""

    ACTIONS = (
        PluginAction(
            "ida_multi_chat:connect",
            "Connect",
            "Connect to the Hub Server",
            "Edit/IDA Multi Chat/Connect",
        ),
        PluginAction(
            "ida_multi_chat:disconnect",
            "Disconnect",
            "Disconnect the current Hub session",
            "Edit/IDA Multi Chat/Disconnect",
        ),
        PluginAction(
            "ida_multi_chat:settings",
            "Settings",
            "Configure Hub Server settings",
            "Edit/IDA Multi Chat/Settings",
        ),
    )

    def __init__(self) -> None:
        """Initialize persistent config and runtime holders."""

        super().__init__()
        self._config_store = HubConfigPersistence()
        self._config = HubConfig()
        self._client: IDAHubClient | None = None
        self._action_handlers: dict[str, MenuActionHandler] = {}
        self._registered_actions = False

    def init(self) -> int:
        """IDA lifecycle hook: initialize plugin and optional auto-connect."""

        self._config = self._config_store.load()
        self._client = IDAHubClient(
            config=self._config,
            script_executor=IDAScriptExecutor().execute,
            status_callback=self._on_client_status,
        )
        self._register_actions()
        self._log(
            f"IDA Multi Chat loaded. Current config: {self._config.host}:{self._config.port}"
        )
        if self._config.auto_connect:
            self.connect_to_hub(retry_on_initial_failure=False)
        return idaapi.PLUGIN_KEEP

    def run(self, _arg: int) -> None:
        """IDA lifecycle hook for hotkey entry (unused)."""

        return

    def term(self) -> None:
        """IDA lifecycle hook: disconnect and unregister actions."""

        if self._client is not None:
            self._client.disconnect()
        self._unregister_actions()

    def handle_action(self, action_name: str) -> None:
        """Dispatch menu action to corresponding operation."""

        if action_name == "ida_multi_chat:connect":
            self.connect_to_hub()
            return
        if action_name == "ida_multi_chat:disconnect":
            self.disconnect_from_hub()
            return
        if action_name == "ida_multi_chat:settings":
            self.open_settings()

    def get_action_state(self, action_name: str) -> int:
        """Compute whether a menu action should be enabled."""

        client = self._client
        if client is None:
            return idaapi.AST_DISABLE_ALWAYS

        if action_name == "ida_multi_chat:connect":
            enabled = not client.is_connected() and not client.is_connecting()
        elif action_name == "ida_multi_chat:disconnect":
            enabled = client.is_connected()
        elif action_name == "ida_multi_chat:settings":
            enabled = True
        else:
            enabled = False

        return idaapi.AST_ENABLE_ALWAYS if enabled else idaapi.AST_DISABLE_ALWAYS

    def connect_to_hub(self, retry_on_initial_failure: bool = True) -> None:
        """Request Hub client connection."""

        if self._client is None:
            return

        try:
            self._client.connect(
                retry_on_initial_failure=retry_on_initial_failure,
            )
        except Exception as exc:
            self._log(f"Connection failed: {exc}")
            return

    def disconnect_from_hub(self) -> None:
        """Request Hub client disconnection."""

        if self._client is None:
            return
        if self._client.disconnect():
            self._log("Disconnect requested")

    def open_settings(self) -> None:
        """Open settings dialog and persist user choices."""

        try:
            dialog = HubSettingsForm(self._config)
            new_config = dialog.prompt()
        except Exception as exc:
            self._log(f"Failed to open settings: {exc}")
            return

        if new_config is None:
            return

        try:
            self._config_store.save(new_config)
        except OSError as exc:
            self._log(f"Failed to save settings: {exc}")
            return

        self._config = new_config
        if self._client is not None:
            self._client.update_config(new_config)

        self._log(
            f"Settings saved: {new_config.host}:{new_config.port}, "
            f"reconnect interval {new_config.reconnect_interval:g}s, "
            f"auto_connect={'1' if new_config.auto_connect else '0'}"
        )

    def _register_actions(self) -> None:
        """Register and attach plugin menu actions."""

        if self._registered_actions:
            return

        for action in self.ACTIONS:
            handler = MenuActionHandler(self, action.name)
            self._action_handlers[action.name] = handler
            desc = idaapi.action_desc_t(
                action.name,
                action.label,
                handler,
                None,
                action.tooltip,
            )
            idaapi.register_action(desc)
            idaapi.attach_action_to_menu(
                action.menu_path, action.name, idaapi.SETMENU_APP
            )

        self._registered_actions = True

    def _unregister_actions(self) -> None:
        """Detach and unregister plugin menu actions."""

        if not self._registered_actions:
            return

        for action in self.ACTIONS:
            try:
                idaapi.detach_action_from_menu(action.menu_path, action.name)
            except Exception:
                pass
            try:
                idaapi.unregister_action(action.name)
            except Exception:
                pass

        self._registered_actions = False
        self._action_handlers.clear()

    def _on_client_status(self, _state: str, message: str) -> None:
        """Forward client status to IDA output."""

        if message:
            self._log(message)

    @staticmethod
    def _log(message: str) -> None:
        """Write plugin log message with consistent prefix and timestamp."""

        prefix = "[IDA Multi Chat] "
        timestamp = datetime.now().strftime("%m-%d %H:%M:%S")
        text = message
        if text.startswith(prefix):
            text = text[len(prefix) :]

        # 优先写入 IDA Output 窗口，不可用时退回标准输出.
        if hasattr(ida_kernwin, "msg"):
            ida_kernwin.msg(f"{prefix}[{timestamp}] {text}\n")
        else:
            print(f"{prefix}[{timestamp}] {text}")
