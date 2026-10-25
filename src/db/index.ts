import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  // Supabase's transaction pooler does not support prepared statements.
  const client = postgres(connectionString, { prepare: false });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;

let instance: Db | undefined;

// Created on first use so `next build` does not need runtime secrets.
export function getDb(): Db {
  instance ??= createDb();
  return instance;
}
