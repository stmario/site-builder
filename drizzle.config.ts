import { defineConfig } from "drizzle-kit"

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Add it to .env.local, then run pnpm db:push.",
  )
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
})
