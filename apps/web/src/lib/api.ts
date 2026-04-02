import { messages } from "./i18n/messages";
import { formatMessage, getInitialLocale } from "./i18n/helpers";
import type {
  AgentConfigResponse, ExecuteRequest, ExecuteResponse,
  IDAConfigResponse, InstanceInfo, NetworkInterfacesResponse, UserTokenResponse,
} from "./types";
import { getToken, clearAuth } from "./auth";

const HUB_URL = (import.meta.env.VITE_HUB_URL ?? "").replace(/\/+$/, "");
const API_BASE = HUB_URL ? `${HUB_URL}/api` : "/api";

function getCommonMessage(key: keyof (typeof messages)["zh"]["common"]): string {
  const locale = getInitialLocale();
  return messages[locale].common[key];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!response.ok) {
    if (response.status === 401) {
      clearAuth();
      window.location.href = "/login";
      throw new Error(getCommonMessage("apiUnauthorized"));
    }
    const text = await response.text();
    throw new Error(text || formatMessage(getCommonMessage("requestFailedWithStatus"), { status: response.status }));
  }
  return (await response.json()) as T;
}

export function fetchInstances(): Promise<InstanceInfo[]> { return request<InstanceInfo[]>("/instances"); }
export function fetchNetworkInterfaces(): Promise<NetworkInterfacesResponse> { return request<NetworkInterfacesResponse>("/network/interfaces"); }
export function fetchAgentConfig(ip: string): Promise<AgentConfigResponse> { return request<AgentConfigResponse>(`/agent_config?${new URLSearchParams({ ip })}`); }
export function fetchIDAConfig(ip: string): Promise<IDAConfigResponse> { return request<IDAConfigResponse>(`/ida_config?${new URLSearchParams({ ip })}`); }
export function executeCode(payload: ExecuteRequest): Promise<ExecuteResponse> {
  return request<ExecuteResponse>("/execute", { method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } });
}
export function login(username: string, pw: string): Promise<UserTokenResponse> {
  return fetch(`${API_BASE}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password: pw }) })
    .then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); });
}
export function register(username: string, pw: string): Promise<UserTokenResponse> {
  return fetch(`${API_BASE}/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password: pw }) })
    .then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); });
}
