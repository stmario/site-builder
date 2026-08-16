/** Public base URL for this app (no trailing slash). */
export function getAppUrl(): string {
  const fromEnv =
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

  return fromEnv.replace(/\/+$/, "")
}

export function getMcpEndpointUrl(): string {
  return `${getAppUrl()}/api/mcp`
}
