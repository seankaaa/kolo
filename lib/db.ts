import { promises as fs } from "fs";
import path from "path";
import type { DB } from "./types";

const DB_PATH = path.join(process.cwd(), "data", "db.json");
const SEED_PATH = path.join(process.cwd(), "data", "seed.json");

// Serialize writes so concurrent requests from two windows don't clobber each other.
let queue: Promise<unknown> = Promise.resolve();

export async function readDB(): Promise<DB> {
  try {
    return JSON.parse(await fs.readFile(DB_PATH, "utf8"));
  } catch {
    const seed = await fs.readFile(SEED_PATH, "utf8");
    await fs.writeFile(DB_PATH, seed);
    return JSON.parse(seed);
  }
}

export function updateDB<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = await readDB();
    const result = await fn(db);
    await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
    return result;
  });
  queue = run.catch(() => {});
  return run;
}

export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
