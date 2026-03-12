import type {
  ConfigResponse,
  ExecuteRequest,
  ExecuteResponse,
  InstanceInfo,
  NetworkInterfacesResponse
} from "./types";

const HUB_URL = (process.env.NEXT_PUBLIC_HUB_URL ?? "").replace(/\/+$/, "");
const API_BASE = HUB_URL ? `${HUB_URL}/api` : "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  // Only set JSON header when sending a body.
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();

    // Friendly hint when frontend dev server receives /api requests.
    if (contentType.includes("text/html") && response.status === 404) {
      throw new Error(
        "API endpoint not found. 如果你在本地单独运行前端，请设置 NEXT_PUBLIC_HUB_URL=http://127.0.0.1:10086"
      );
    }

    throw new Error(text || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export function fetchInstances(): Promise<InstanceInfo[]> {
  return request<InstanceInfo[]>("/instances");
}

export function fetchNetworkInterfaces(): Promise<NetworkInterfacesResponse> {
  return request<NetworkInterfacesResponse>("/network/interfaces");
}

export function fetchConfig(ip: string): Promise<ConfigResponse> {
  const query = new URLSearchParams({ ip });
  return request<ConfigResponse>(`/config?${query.toString()}`);
}

export function executeCode(payload: ExecuteRequest): Promise<ExecuteResponse> {
  return request<ExecuteResponse>("/execute", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json"
    }
  });
}
