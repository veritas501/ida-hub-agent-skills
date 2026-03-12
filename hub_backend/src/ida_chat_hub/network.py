from __future__ import annotations

import ipaddress
import socket
from dataclasses import dataclass

import psutil


@dataclass(frozen=True)
class IPv4Interface:
    name: str
    ipv4: str
    is_loopback: bool


def list_ipv4_interfaces() -> list[IPv4Interface]:
    items: list[IPv4Interface] = []

    for if_name, addresses in psutil.net_if_addrs().items():
        for addr in addresses:
            if addr.family != socket.AF_INET:
                continue

            ip = str(addr.address).strip()
            if not ip:
                continue

            try:
                parsed = ipaddress.ip_address(ip)
            except ValueError:
                continue

            if parsed.is_unspecified:
                continue

            items.append(
                IPv4Interface(
                    name=if_name,
                    ipv4=str(parsed),
                    is_loopback=parsed.is_loopback,
                )
            )

    unique: dict[tuple[str, str], IPv4Interface] = {}
    for item in items:
        unique[(item.name, item.ipv4)] = item

    return sorted(unique.values(), key=lambda x: (x.is_loopback, x.name.lower(), x.ipv4))


def detect_outbound_ipv4() -> str | None:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    except OSError:
        return None

    try:
        sock.connect(("8.8.8.8", 80))
        ip = str(sock.getsockname()[0]).strip()
    except OSError:
        return None
    finally:
        sock.close()

    try:
        parsed = ipaddress.ip_address(ip)
    except ValueError:
        return None

    if parsed.is_unspecified:
        return None
    return str(parsed)


def pick_default_ipv4(interfaces: list[IPv4Interface]) -> str:
    outbound = detect_outbound_ipv4()
    if outbound:
        for item in interfaces:
            if item.ipv4 == outbound:
                return outbound

    for item in interfaces:
        if not item.is_loopback:
            return item.ipv4

    return interfaces[0].ipv4 if interfaces else "127.0.0.1"
