/** Hostnames that redirect (e.g. apex → www). MCP clients drop auth headers on redirect. */
const CANONICAL_HOSTS: Record<string, string> = {
  "site-builder.site": "www.site-builder.site",
}

function isLocalhostUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  } catch {
    return false
  }
}

function canonicalizePublicUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const canonicalHost = CANONICAL_HOSTS[parsed.hostname]
    if (canonicalHost) parsed.hostname = canonicalHost
    return parsed.toString().replace(/\/+$/, "")
  } catch {
    return url.replace(/\/+$/, "")
  }
}

function publicEnvUrl(name: "BETTER_AUTH_URL" | "APP_URL"): string | undefined {
  const value = process.env[name]?.trim()
  if (!value) return undefined
  if (process.env.NODE_ENV !== "development" && isLocalhostUrl(value)) return undefined
  return value.replace(/\/+$/, "")
}

/** Public base URL for this app (no trailing slash). */
export function getAppUrl(): string {
  const fromEnv =
    publicEnvUrl("BETTER_AUTH_URL") ??
    publicEnvUrl("APP_URL") ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.V0_RUNTIME_URL ??
          (process.env.NODE_ENV === "development"
            ? "http://localhost:3000"
            : "https://www.site-builder.site"))

  return canonicalizePublicUrl(fromEnv)
}

export function getMcpEndpointUrl(): string {
  return `${getAppUrl()}/api/mcp`
}
