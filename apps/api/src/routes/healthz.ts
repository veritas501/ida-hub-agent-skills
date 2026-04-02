// Health check route.

import { Hono } from "hono";

const healthz = new Hono();

healthz.get("/healthz", (c) => {
  return c.json({ status: "ok" });
});

export default healthz;
