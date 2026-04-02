// Network interface detection — replaces psutil-based Python implementation.
// Uses Node.js built-in os.networkInterfaces().

import * as os from "node:os";
import * as net from "node:net";
import * as dgram from "node:dgram";
import type { IPv4InterfaceItem } from "@ida-claw/shared";

/** List all IPv4 network interfaces, sorted non-loopback first. */
export function listIPv4Interfaces(): IPv4InterfaceItem[] {
  const ifaces = os.networkInterfaces();
  const seen = new Map<string, IPv4InterfaceItem>();

  for (const [ifName, addrs] of Object.entries(ifaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family !== "IPv4") continue;
      const ip = addr.address.trim();
      if (!ip || ip === "0.0.0.0") continue;

      // lo 接口仅保留 127.0.0.1，其余绑定地址（如 WSL2 的 10.255.255.254）无实际用途
      if (ifName === "lo" && ip !== "127.0.0.1") continue;

      const key = `${ifName}:${ip}`;
      if (!seen.has(key)) {
        seen.set(key, {
          name: ifName,
          ipv4: ip,
          is_loopback: addr.internal,
        });
      }
    }
  }

  return [...seen.values()].sort((a, b) => {
    if (a.is_loopback !== b.is_loopback) return a.is_loopback ? 1 : -1;
    const nameCmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    if (nameCmp !== 0) return nameCmp;
    return a.ipv4.localeCompare(b.ipv4);
  });
}

/** Detect outbound IPv4 by attempting a UDP "connect" to 8.8.8.8. */
export function detectOutboundIPv4(): Promise<string | null> {
  return new Promise((resolve) => {
    const sock = dgram.createSocket("udp4");
    sock.connect(80, "8.8.8.8", () => {
      try {
        const addr = sock.address();
        sock.close();
        const ip = addr.address;
        resolve(!ip || ip === "0.0.0.0" ? null : ip);
      } catch {
        sock.close();
        resolve(null);
      }
    });
    sock.on("error", () => {
      sock.close();
      resolve(null);
    });
    // Timeout after 1s
    setTimeout(() => {
      try { sock.close(); } catch { /* ignore */ }
      resolve(null);
    }, 1000);
  });
}

/** Pick the best default IPv4 address from available interfaces. */
export async function pickDefaultIPv4(interfaces: IPv4InterfaceItem[]): Promise<string> {
  const outbound = await detectOutboundIPv4();
  if (outbound) {
    for (const item of interfaces) {
      if (item.ipv4 === outbound) return outbound;
    }
  }

  for (const item of interfaces) {
    if (!item.is_loopback) return item.ipv4;
  }

  return interfaces.length > 0 ? interfaces[0].ipv4 : "127.0.0.1";
}

/** Fetch public IPv4 from ip.sb (使用 api-ipv4 端点强制 IPv4 解析). */
export async function fetchPublicIPv4(timeout = 5000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch("https://api-ipv4.ip.sb/ip", { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    if (!text || !net.isIPv4(text)) return null;
    return text;
  } catch {
    return null;
  }
}

/** Validate an IPv4 address string. Returns normalized IP or null. */
export function validateIPv4(ip: string): string | null {
  if (!net.isIPv4(ip) || ip === "0.0.0.0") return null;
  return ip;
}
