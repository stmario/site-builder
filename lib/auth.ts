import { betterAuth } from "better-auth"
import { Pool } from "pg"

const runtimeUrl =
  process.env.BETTER_AUTH_URL ??
  process.env.APP_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.V0_RUNTIME_URL ??
        (process.env.NODE_ENV === "development"
          ? "http://localhost:3000"
          : "https://site-builder.site"))

const trustedOrigins = [
  process.env.BETTER_AUTH_URL,
  process.env.APP_URL,
  process.env.V0_RUNTIME_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined,
  process.env.NODE_ENV === "development" ? "http://localhost:3000" : undefined,
  "https://site-builder.site",
].filter(Boolean) as string[]

export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  baseURL: runtimeUrl,
  trustedOrigins,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
  },
  advanced:
    process.env.NODE_ENV === "development"
      ? process.env.V0_RUNTIME_URL
        ? {
            defaultCookieAttributes: {
              sameSite: "none",
              secure: true,
            },
          }
        : {
            defaultCookieAttributes: {
              sameSite: "lax",
              secure: false,
            },
          }
      : undefined,
})
