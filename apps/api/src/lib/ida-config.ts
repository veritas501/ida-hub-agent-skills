// IDA Hub config encoding — idahub:// URL scheme (base64url JSON).

const IDA_CONFIG_SCHEME = "idahub://";
const IDA_CONFIG_VERSION = 2;

export function encodeIDAConfig(host: string, port: number, token: string): string {
  const payload = {
    host,
    port,
    token,
    version: IDA_CONFIG_VERSION,
  };
  // Match Python: sort_keys=True, separators=(",",":")
  const raw = JSON.stringify(payload, Object.keys(payload).sort());
  const encoded = Buffer.from(raw, "utf-8")
    .toString("base64url")
    .replace(/=+$/, "");
  return `${IDA_CONFIG_SCHEME}${encoded}`;
}
