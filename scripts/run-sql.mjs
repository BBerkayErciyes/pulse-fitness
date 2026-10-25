// Usage: node scripts/run-sql.mjs <file.sql>
// Runs a SQL file against DIRECT_URL (falls back to DATABASE_URL).
import { readFile } from "node:fs/promises";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: [".env.local", ".env"], quiet: true });

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/run-sql.mjs <file.sql>");
  process.exit(1);
}

const sql = postgres(process.env.DIRECT_URL ?? process.env.DATABASE_URL, {
  max: 1,
  onnotice: () => {},
});

try {
  const results = await sql.unsafe(await readFile(file, "utf8")).simple();
  // A single statement yields its rows directly; multiple yield one result per statement.
  const sets = results.length && Array.isArray(results[0]) ? results : [results];
  const last = sets.filter((r) => r.length).at(-1);
  if (last) console.table(last);
} catch (err) {
  console.error(`FAILED: ${err.message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
