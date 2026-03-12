from __future__ import annotations

from dataclasses import dataclass

import idaapi  # type: ignore
import ida_kernwin  # type: ignore

from .config_persistence import HubConfigPersistence
from .core import IDAScriptExecutor
from .hub_client import HubConfig, IDAHubClient


class HubSettingsForm(ida_kernwin.Form):  # type: ignore[misc]
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
""",
            {
                "host": ida_kernwin.Form.StringInput(swidth=40),
                "port": ida_kernwin.Form.StringInput(swidth=16),
                "reconnect": ida_kernwin.Form.StringInput(swidth=16),
            },
        )

    def prompt(self) -> HubConfig | None:
        self.Compile()
        self.host.value = self._initial_config.host
        self.port.value = str(self._initial_config.port)
        self.reconnect.value = str(self._initial_config.reconnect_interval)

        try:
            ok = self.Execute()
            if ok != 1:
                return None

            host = str(self.host.value or "").strip() or self._initial_config.host
            port = int(str(self.port.value or "").strip())
            reconnect = float(str(self.reconnect.value or "").strip())
            return HubConfig(host=host, port=port, reconnect_interval=reconnect)
        finally:
            self.Free()


@dataclass(frozen=True)
class PluginAction:
    name: str
    label: str
    tooltip: str
    menu_path: str


class MenuActionHandler(idaapi.action_handler_t):
    def __init__(self, plugin: "IDAMultiChatPlugin", action_name: str) -> None:
        super().__init__()
        self._plugin = plugin
        self._action_name = action_name

    def activate(self, _ctx) -> int:
        self._plugin.handle_action(self._action_name)
        return 1

    def update(self, _ctx) -> int:
        return self._plugin.get_action_state(self._action_name)


class IDAMultiChatPlugin(idaapi.plugin_t):
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
        super().__init__()
        self._config_store = HubConfigPersistence()
        self._config = HubConfig()
        self._client: IDAHubClient | None = None
        self._action_handlers: dict[str, MenuActionHandler] = {}
        self._registered_actions = False

    def init(self) -> int:
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
        return idaapi.PLUGIN_KEEP

    def run(self, _arg: int) -> None:
        return

    def term(self) -> None:
        if self._client is not None:
            self._client.disconnect()
        self._unregister_actions()

    def handle_action(self, action_name: str) -> None:
        if action_name == "ida_multi_chat:connect":
            self.connect_to_hub()
            return
        if action_name == "ida_multi_chat:disconnect":
            self.disconnect_from_hub()
            return
        if action_name == "ida_multi_chat:settings":
            self.open_settings()

    def get_action_state(self, action_name: str) -> int:
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

    def connect_to_hub(self) -> None:
        if self._client is None:
            return

        try:
            self._client.connect()
        except Exception as exc:
            self._log(f"Connection failed: {exc}")
            return

    def disconnect_from_hub(self) -> None:
        if self._client is None:
            return
        if self._client.disconnect():
            self._log("Disconnect requested")

    def open_settings(self) -> None:
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
            f"reconnect interval {new_config.reconnect_interval:g}s"
        )

    def _register_actions(self) -> None:
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
        if message:
            self._log(message)

    @staticmethod
    def _log(message: str) -> None:
        prefix = "[IDA Multi Chat] "
        text = message
        if text.startswith(prefix):
            text = text[len(prefix) :]

        if hasattr(ida_kernwin, "msg"):
            ida_kernwin.msg(f"{prefix}{text}\n")
        else:
            print(f"{prefix}{text}")
