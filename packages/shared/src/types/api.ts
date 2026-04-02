// API response types — shared between api and web packages.

export const EXECUTE_CODE_MAX_CHARS = 10_000_000;

export interface InstanceInfo {
  instance_id: string;
  module: string;
  db_path: string;
  architecture: string;
  platform: string;
  connected_at: string;
}

export interface ExecuteRequest {
  instance_id: string;
  code: string;
}

export interface ExecuteResponse {
  success: boolean;
  output: string | null;
  error: string | null;
  request_id: string;
}

export interface AgentConfigResponse {
  result: string;
  selected_ip: string;
  port: number;
}

export interface IDAConfigResponse {
  selected_ip: string;
  port: number;
  ida_config: string;
}

export interface IPv4InterfaceItem {
  name: string;
  ipv4: string;
  is_loopback: boolean;
}

export interface NetworkInterfacesResponse {
  interfaces: IPv4InterfaceItem[];
  default_ip: string;
}

export interface UserTokenResponse {
  username: string;
  token: string;
}

export interface ExecuteResultMessage {
  request_id: string;
  success: boolean;
  output?: string | null;
  error?: string | null;
}

export interface InstanceMeta {
  module: string;
  db_path: string;
  architecture: string;
  platform: string;
}
