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

export interface ConfigResponse {
  // New backend shape
  result?: string;
  selected_ip?: string;
  port?: number;

  // Backward-compatible fields for older backend/frontend combinations
  hub_url?: string;
  curl_examples?: Record<string, string>;
  python_helper?: string;
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
