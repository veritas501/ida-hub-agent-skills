// 数据库初始化、用户 CRUD — 基于 bun:sqlite + Drizzle ORM
import { Database } from "bun:sqlite";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import path from "node:path";
import fs from "node:fs";
import { users } from "./schema.js";
import { createLogger } from "../logger.js";

const logger = createLogger("db");

export type DB = BunSQLiteDatabase<Record<string, never>>;

export interface UserRow {
  id: number;
  username: string;
  token: string;
}

export function initDB(dbPath: string): DB {
  const resolved = path.resolve(dbPath.replace(/^~/, () => process.env.HOME || "~"));
  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  const sqlite = new Database(resolved);
  sqlite.exec("PRAGMA journal_mode = WAL");

  // 建表（如不存在）
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      token         TEXT    NOT NULL UNIQUE,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const db = drizzle(sqlite);
  logger.info("Database initialized", { dbPath: resolved });
  return db;
}

// --- User CRUD ---

export async function createUser(db: DB, username: string, password: string): Promise<{ username: string; token: string }> {
  const passwordHash = await bcrypt.hash(password, 10);
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const token = Buffer.from(bytes).toString("base64url");

  try {
    await db.insert(users).values({ username, passwordHash, token });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("UNIQUE constraint")) {
      throw new Error("Username already exists");
    }
    throw err;
  }

  logger.info("User created", { username });
  return { username, token };
}

export async function verifyLogin(db: DB, username: string, password: string): Promise<{ username: string; token: string } | null> {
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  const row = rows[0];
  if (!row) return null;

  const valid = await bcrypt.compare(password, row.passwordHash);
  if (!valid) return null;

  return { username: row.username, token: row.token };
}

export async function getUserByToken(db: DB, token: string): Promise<UserRow | null> {
  const rows = await db.select({
    id: users.id,
    username: users.username,
    token: users.token,
  }).from(users).where(eq(users.token, token)).limit(1);

  return rows[0] ?? null;
}
