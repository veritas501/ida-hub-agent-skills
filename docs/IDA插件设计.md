# IDA 插件设计文档

## 1. 概述

IDA Pro 插件，负责连接 Hub Server 并执行远程下发的 Python 代码。

## 2. 文件结构

```
ida-chat-plugin/
├── ida_chat_plugin.py      # 插件入口（修改）
├── ida_hub_client.py       # Hub 客户端（新增）
├── ida_chat_core.py        # 核心模块（保留）
└── ...
```

## 3. Hub 客户端 (ida_hub_client.py)

```python
"""
IDA Hub Client - 连接 Hub Server 的 WebSocket 客户端
"""

import json
import uuid
import threading
import queue
import websocket
from typing import Optional, Callable
from dataclasses import dataclass

@dataclass
class HubConfig:
    """Hub 连接配置"""
    url: str = "ws://localhost:8765/ws"
    reconnect_interval: float = 5.0
    heartbeat_interval: float = 30.0

class IDAHubClient:
    """IDA Hub 客户端"""

    def __init__(self, config: Optional[HubConfig] = None):
        self.config = config or HubConfig()
        self.ws: Optional[websocket.WebSocketApp] = None
        self.instance_id: str = self._generate_id()
        self.connected: bool = False
        self.pending_requests: dict[str, queue.Queue] = {}
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def _generate_id(self) -> str:
        """生成实例 ID"""
        return uuid.uuid4().hex[:8]

    def _get_instance_info(self) -> dict:
        """获取当前 IDA 实例信息（用于注册）"""
        import idaapi

        # 获取模块信息
        module_name = idaapi.get_root_filename()
        db_path = idaapi.get_input_file_path()

        # 获取架构信息
        info = idaapi.get_inf_structure()
        arch = self._get_arch_name(info)

        return {
            "module": module_name,
            "db_path": db_path,
            "architecture": arch,
        }

    def _get_arch_name(self, info) -> str:
        """获取架构名称"""
        proc_name = str(info.procname)
        arch_map = {
            "metapc": "x86",
            "ARM": "arm",
            "ARM64": "aarch64",
            "PPC": "powerpc",
            "MIPS": "mips",
        }
        return arch_map.get(proc_name, proc_name)

    def connect(self):
        """连接到 Hub Server"""
        if self._thread and self._thread.is_alive():
            return

        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

    def disconnect(self):
        """断开连接"""
        self._stop_event.set()
        if self.ws:
            self.ws.close()
        if self._thread:
            self._thread.join(timeout=5.0)
        self.connected = False

    def _run_loop(self):
        """WebSocket 运行循环"""
        while not self._stop_event.is_set():
            try:
                self._connect_and_run()
            except Exception as e:
                print(f"[IDA Hub] Connection error: {e}")

            if not self._stop_event.is_set():
                import time
                time.sleep(self.config.reconnect_interval)

    def _connect_and_run(self):
        """建立连接并运行"""
        self.ws = websocket.WebSocketApp(
            self.config.url,
            on_open=self._on_open,
            on_message=self._on_message,
            on_error=self._on_error,
            on_close=self._on_close
        )
        self.ws.run_forever()

    def _on_open(self, ws):
        """连接建立时发送注册消息"""
        info = self._get_instance_info()

        register_msg = {
            "type": "register",
            "instance_id": self.instance_id,
            "info": info
        }

        ws.send(json.dumps(register_msg))
        print(f"[IDA Hub] Registering as {self.instance_id}")

    def _on_message(self, ws, message):
        """处理收到的消息"""
        try:
            data = json.loads(message)
            msg_type = data.get("type")

            if msg_type == "register_ack":
                self.connected = True
                print(f"[IDA Hub] Connected as {data.get('instance_id')}")

            elif msg_type == "execute":
                self._handle_execute(data)

            elif msg_type == "heartbeat":
                ws.send(json.dumps({"type": "heartbeat"}))

        except json.JSONDecodeError:
            print(f"[IDA Hub] Invalid JSON: {message}")

    def _on_error(self, ws, error):
        """处理错误"""
        print(f"[IDA Hub] WebSocket error: {error}")
        self.connected = False

    def _on_close(self, ws, close_status_code, close_msg):
        """连接关闭"""
        print(f"[IDA Hub] Disconnected: {close_status_code} - {close_msg}")
        self.connected = False

    def _handle_execute(self, data: dict):
        """处理执行请求"""
        request_id = data.get("request_id")
        code = data.get("code")

        result = self._execute_code(code)

        response = {
            "type": "execute_result",
            "request_id": request_id,
            **result
        }

        if self.ws:
            self.ws.send(json.dumps(response))

    def _execute_code(self, code: str) -> dict:
        """执行 Python 代码"""
        import sys
        from io import StringIO

        # 捕获输出
        old_stdout = sys.stdout
        sys.stdout = captured = StringIO()

        try:
            # 创建执行上下文
            context = self._create_context()

            # 执行代码
            exec(code, context)

            return {
                "success": True,
                "output": captured.getvalue(),
                "error": None
            }

        except Exception as e:
            import traceback
            return {
                "success": False,
                "output": captured.getvalue(),
                "error": f"{type(e).__name__}: {e}\n{traceback.format_exc()}"
            }

        finally:
            sys.stdout = old_stdout

    def _create_context(self) -> dict:
        """创建代码执行上下文"""
        import idaapi
        import idautils
        import idc

        # 创建简化的 db 对象
        db = IDADatabase()

        return {
            "idaapi": idaapi,
            "idautils": idautils,
            "idc": idc,
            "db": db,
            # 常用快捷方式
            "here": idc.here(),
        }


class IDADatabase:
    """IDA 数据库封装，提供简化的 API"""

    @property
    def functions(self):
        """函数迭代器"""
        return IDAFunctions()

    @property
    def strings(self):
        """字符串迭代器"""
        import idautils
        return idautils.Strings()

    @property
    def module(self):
        """模块名"""
        import idaapi
        return idaapi.get_root_filename()

    @property
    def segments(self):
        """段迭代器"""
        import idautils
        return idautils.Segments()

    def xrefs(self):
        """交叉引用"""
        import idautils
        return idautils.XrefsTo


class IDAFunctions:
    """函数集合封装"""

    def __iter__(self):
        import idautils
        import idaapi
        for ea in idautils.Functions():
            yield IDAFunction(ea)

    def __len__(self):
        import idautils
        return len(list(idautils.Functions()))

    def get_at(self, ea: int):
        """获取指定地址的函数"""
        import idaapi
        func = idaapi.get_func(ea)
        if func:
            return IDAFunction(func.start_ea)
        return None

    def get_name(self, func) -> str:
        """获取函数名"""
        import idc
        if hasattr(func, 'start_ea'):
            return idc.get_func_name(func.start_ea)
        return idc.get_func_name(func)


class IDAFunction:
    """单个函数封装"""

    def __init__(self, ea: int):
        import idaapi
        self._func = idaapi.get_func(ea)
        self.start_ea = self._func.start_ea if self._func else ea
        self.end_ea = self._func.end_ea if self._func else ea

    @property
    def name(self) -> str:
        import idc
        return idc.get_func_name(self.start_ea)

    @property
    def size(self) -> int:
        return self.end_ea - self.start_ea

    def __repr__(self):
        return f"<Function {self.name} @ {hex(self.start_ea)}>"
```

## 4. 插件入口修改 (ida_chat_plugin.py)

```python
"""
IDA Chat Plugin - 修改版，添加 Hub 连接功能
"""

import idaapi
import ida_kernwin
from ida_hub_client import IDAHubClient, HubConfig

class IDAChatPlugin(idaapi.plugin_t):
    """IDA Chat 插件"""

    flags = idaapi.PLUGIN_KEEP
    comment = "IDA Chat with Hub support"
    help = "IDA Chat Plugin"
    wanted_name = "IDA Chat"
    wanted_hotkey = "Ctrl+Shift+C"

    def __init__(self):
        self.hub_client: Optional[IDAHubClient] = None
        self.hub_config = HubConfig()

    def init(self):
        """插件初始化"""
        print("[IDA Chat] Plugin loaded")
        return idaapi.PLUGIN_KEEP

    def run(self, arg):
        """运行插件"""
        self._show_main_dialog()

    def term(self):
        """插件卸载"""
        if self.hub_client:
            self.hub_client.disconnect()
        print("[IDA Chat] Plugin unloaded")

    def _show_main_dialog(self):
        """显示主对话框"""
        class MainDialog(ida_kernwin.Form):
            def __init__(self, plugin):
                self.plugin = plugin
                form_str = """
                IDA Chat
                <#Hub URL#:{strHubUrl}>
                <#Status#:{strStatus}>
                <Connect:{btnConnect}>
                <Disconnect:{btnDisconnect}>
                <Config:{btnConfig}>
                """
                ida_kernwin.Form.__init__(self, form_str, {
                    'strHubUrl': ida_kernwin.Form.StringInput(
                        value=plugin.hub_config.url
                    ),
                    'strStatus': ida_kernwin.Form.StringLabel(
                        value=self._get_status()
                    ),
                    'btnConnect': ida_kernwin.Form.ButtonInput(
                        self._on_connect
                    ),
                    'btnDisconnect': ida_kernwin.Form.ButtonInput(
                        self._on_disconnect
                    ),
                    'btnConfig': ida_kernwin.Form.ButtonInput(
                        self._on_config
                    ),
                })

            def _get_status(self) -> str:
                if self.plugin.hub_client and self.plugin.hub_client.connected:
                    return f"Connected ({self.plugin.hub_client.instance_id})"
                return "Disconnected"

            def _on_connect(self, code):
                url = self.strHubUrl.value
                self.plugin.hub_config.url = url

                if not self.plugin.hub_client:
                    self.plugin.hub_client = IDAHubClient(self.plugin.hub_config)

                self.plugin.hub_client.connect()

                # 更新状态显示
                import time
                time.sleep(1)  # 等待连接
                self.strStatus.value = self._get_status()

            def _on_disconnect(self, code):
                if self.plugin.hub_client:
                    self.plugin.hub_client.disconnect()
                self.strStatus.value = self._get_status()

            def _on_config(self, code):
                self.plugin._show_config_dialog()

        dialog = MainDialog(self)
        dialog.Execute()
        dialog.Free()

    def _show_config_dialog(self):
        """显示配置对话框"""
        class ConfigDialog(ida_kernwin.Form):
            def __init__(self, plugin):
                self.plugin = plugin
                form_str = """
                Hub Configuration
                <#Reconnect Interval (s)#:{strReconnect}>
                <#Heartbeat Interval (s)#:{strHeartbeat}>
                <Save:{btnSave}>
                """
                ida_kernwin.Form.__init__(self, form_str, {
                    'strReconnect': ida_kernwin.Form.NumericInput(
                        tp=ida_kernwin.Form.FT_RAWHEX,
                        value=int(plugin.hub_config.reconnect_interval)
                    ),
                    'strHeartbeat': ida_kernwin.Form.NumericInput(
                        tp=ida_kernwin.Form.FT_RAWHEX,
                        value=int(plugin.hub_config.heartbeat_interval)
                    ),
                    'btnSave': ida_kernwin.Form.ButtonInput(self._on_save),
                })

            def _on_save(self, code):
                self.plugin.hub_config.reconnect_interval = float(self.strReconnect.value)
                self.plugin.hub_config.heartbeat_interval = float(self.strHeartbeat.value)

        dialog = ConfigDialog(self)
        dialog.Execute()
        dialog.Free()


def PLUGIN_ENTRY():
    return IDAChatPlugin()
```

## 5. 配置持久化

```python
# config_persistence.py

import json
import os

CONFIG_FILE = os.path.join(os.path.dirname(__file__), ".hub_config.json")

def load_config() -> dict:
    """加载配置"""
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_config(config: dict):
    """保存配置"""
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=2)
```

## 6. 安装与使用

### 6.1 安装

1. 复制文件到 IDA 插件目录：
   ```
   C:\Program Files\IDA 8.3\plugins\
   或
   %APPDATA%\Hex-Rays\IDA Pro\plugins\
   ```

2. 安装 Python 依赖：
   ```bash
   pip install websocket-client
   ```

### 6.2 使用

1. 启动 IDA 并打开目标文件
2. 按 `Ctrl+Shift+C` 打开插件
3. 输入 Hub Server 地址（如 `ws://192.168.1.100:8765/ws`）
4. 点击 Connect
5. 在 Claude Code 中使用 `/ida list` 查看已连接实例

## 7. 错误处理

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| Connection refused | Hub 未启动 | 启动 Hub Server |
| Register timeout | 网络延迟 | 检查网络连接 |
| WebSocket closed | 连接断开 | 自动重连机制 |

## 8. 安全注意事项

- 代码在 IDA 进程中执行，具有完整 IDA API 权限
- 仅连接可信的 Hub Server
- 不要在不受信任的网络环境中使用
