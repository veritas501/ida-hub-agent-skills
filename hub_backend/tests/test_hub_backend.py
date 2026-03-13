from __future__ import annotations

import queue
import threading

from fastapi.testclient import TestClient

from ida_chat_hub.config import Settings
from ida_chat_hub.main import create_app


def _build_client(*, execute_timeout: float = 0.5) -> TestClient:
    app = create_app(
        Settings(
            host="127.0.0.1",
            port=10086,
            debug=False,
            execute_timeout=execute_timeout,
        )
    )
    return TestClient(app)


def test_healthz() -> None:
    with _build_client() as client:
        response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_network_interfaces_and_config_markdown() -> None:
    with _build_client() as client:
        interfaces_response = client.get("/api/network/interfaces")
        assert interfaces_response.status_code == 200
        interfaces_payload = interfaces_response.json()
        assert isinstance(interfaces_payload["interfaces"], list)
        assert interfaces_payload["interfaces"]
        selected_ip = interfaces_payload["default_ip"]

        all_ips = {item["ipv4"] for item in interfaces_payload["interfaces"]}
        all_ips.add("127.0.0.1")
        assert selected_ip in all_ips

        config_response = client.get("/api/config", params={"ip": selected_ip})
        assert config_response.status_code == 200
        config_payload = config_response.json()
        assert config_payload["selected_ip"] == selected_ip
        assert config_payload["port"] == 10086

        result_text = config_payload["result"]

        # Python helper is the primary recommended path
        assert "## Python Helper (Recommended)" in result_text
        assert "def list_instances(" in result_text
        assert "def execute(" in result_text
        assert "BASE_URL" in result_text
        assert f"http://{selected_ip}:10086" in result_text

        # curl is explicitly labeled as fallback
        assert "curl fallback" in result_text

        # Instances link is present and correct
        assert f"http://{selected_ip}:10086/api/instances" in result_text


def test_register_and_list_instances() -> None:
    with _build_client() as client:
        with client.websocket_connect("/ws") as ws:
            ws.send_json(
                {
                    "type": "register",
                    "instance_id": "inst01",
                    "info": {
                        "module": "calc.exe",
                        "db_path": "C:/calc.i64",
                        "architecture": "x86_64",
                        "platform": "windows",
                    },
                }
            )
            ack = ws.receive_json()
            assert ack == {"type": "register_ack", "instance_id": "inst01"}

            response = client.get("/api/instances")
            assert response.status_code == 200
            payload = response.json()
            assert len(payload) == 1
            assert payload[0]["instance_id"] == "inst01"
            assert payload[0]["module"] == "calc.exe"
            assert payload[0]["architecture"] == "x86_64"


def test_execute_instance_not_found() -> None:
    with _build_client() as client:
        response = client.post(
            "/api/execute",
            json={"instance_id": "missing", "code": "print(1)"},
        )

    assert response.status_code == 404
    assert "Instance not found" in response.json()["detail"]


def test_execute_roundtrip_success() -> None:
    with _build_client(execute_timeout=1.0) as client:
        with client.websocket_connect("/ws") as ws:
            ws.send_json(
                {
                    "type": "register",
                    "instance_id": "inst02",
                    "info": {"module": "sample.exe"},
                }
            )
            ws.receive_json()

            result_queue: queue.Queue[object] = queue.Queue()

            def do_execute() -> None:
                try:
                    response = client.post(
                        "/api/execute",
                        json={"instance_id": "inst02", "code": "print(42)"},
                    )
                    result_queue.put(response)
                except Exception as exc:  # pragma: no cover
                    result_queue.put(exc)

            t = threading.Thread(target=do_execute, daemon=True)
            t.start()

            execute_msg = ws.receive_json()
            assert execute_msg["type"] == "execute"
            assert execute_msg["code"] == "print(42)"
            request_id = execute_msg["request_id"]
            assert isinstance(request_id, str) and request_id

            ws.send_json(
                {
                    "type": "execute_result",
                    "request_id": request_id,
                    "success": True,
                    "output": "42\n",
                    "error": None,
                }
            )

            t.join(timeout=2)
            result = result_queue.get(timeout=2)
            if isinstance(result, Exception):  # pragma: no cover
                raise result

            assert result.status_code == 200
            body = result.json()
            assert body["success"] is True
            assert body["output"] == "42\n"
            assert body["error"] is None
            assert body["request_id"] == request_id


def test_execute_timeout_returns_504() -> None:
    with _build_client(execute_timeout=0.05) as client:
        with client.websocket_connect("/ws") as ws:
            ws.send_json(
                {
                    "type": "register",
                    "instance_id": "inst03",
                    "info": {"module": "sample.exe"},
                }
            )
            ws.receive_json()

            response = client.post(
                "/api/execute",
                json={"instance_id": "inst03", "code": "print('slow')"},
            )

            assert response.status_code == 504
            assert response.json()["detail"] == "Execute timed out"


def test_config_rejects_invalid_ip() -> None:
    with _build_client() as client:
        response = client.get("/api/config", params={"ip": "203.0.113.123"})

    assert response.status_code == 400
    assert "Invalid ip" in response.json()["detail"]
