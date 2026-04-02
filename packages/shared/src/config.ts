import { parseArgs } from "node:util";
import { z } from "zod";
import path from "node:path";
import os from "node:os";

const configSchema = z.object({
  host: z.string().default("0.0.0.0"),
  port: z.coerce.number().int().min(1).max(65535).default(10086),
  timeout: z.coerce.number().positive().default(30),
  db: z.string().default(path.join(os.homedir(), ".ida_hub", "hub_users.db")),
  debug: z.boolean().default(false),
});

export type Config = z.infer<typeof configSchema>;

function parseCliArgs(): Partial<Config> {
  const { values } = parseArgs({
    options: {
      host: { type: "string" },
      port: { type: "string" },
      timeout: { type: "string" },
      db: { type: "string" },
      debug: { type: "boolean", default: false },
    },
    strict: true,
  });

  return {
    ...(values.host && { host: values.host }),
    ...(values.port && { port: Number(values.port) }),
    ...(values.timeout && { timeout: Number(values.timeout) }),
    ...(values.db && { db: values.db }),
    debug: values.debug as boolean,
  };
}

let _config: Config | null = null;

export function getConfig(): Config {
  if (_config) return _config;
  const cliArgs = parseCliArgs();
  _config = configSchema.parse(cliArgs);
  return _config;
}
