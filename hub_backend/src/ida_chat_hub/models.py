from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class InstanceMeta(BaseModel):
    module: str = "unknown"
    db_path: str = ""
    architecture: str = "unknown"
    platform: str = "unknown"


class InstanceInfo(BaseModel):
    instance_id: str
    module: str
    db_path: str
    architecture: str
    platform: str
    connected_at: datetime


class ExecuteRequest(BaseModel):
    instance_id: str = Field(min_length=1)
    code: str


class ExecuteResponse(BaseModel):
    success: bool
    output: str | None
    error: str | None
    request_id: str


class ConfigResponse(BaseModel):
    result: str
    selected_ip: str
    port: int


class IPv4InterfaceItem(BaseModel):
    name: str
    ipv4: str
    is_loopback: bool


class NetworkInterfacesResponse(BaseModel):
    interfaces: list[IPv4InterfaceItem]
    default_ip: str


class ExecuteResultMessage(BaseModel):
    request_id: str = Field(min_length=1)
    success: bool
    output: str | None = None
    error: str | None = None
