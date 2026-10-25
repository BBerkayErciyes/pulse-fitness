import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Same precedence as Next.js: .env.local overrides .env.
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Only manage our own schema; auth.* belongs to Supabase.
  schemaFilter: ["public"],
  dbCredentials: {
    // Migrations need a session connection (port 5432), not the transaction pooler.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
