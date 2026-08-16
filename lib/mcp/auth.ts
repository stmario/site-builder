import { randomBytes } from "crypto"
import { db } from "@/lib/db"
import { user } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import type { AuthInfo } from "@modelcontextprotocol/server"

export const MCP_USER_ID_KEY = "userId"

export function generateMcpApiKey(): string {
  return `latch_${randomBytes(32).toString("hex")}`
}

export async function getUserIdFromMcpApiKey(
  apiKey: string,
): Promise<string | null> {
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.mcpApiKey, apiKey))
    .limit(1)
  return rows[0]?.id ?? null
}

export async function ensureMcpApiKeyForUser(userId: string): Promise<string> {
  const rows = await db
    .select({ mcpApiKey: user.mcpApiKey })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  const existing = rows[0]?.mcpApiKey
  if (existing) return existing

  const mcpApiKey = generateMcpApiKey()
  await db
    .update(user)
    .set({ mcpApiKey, updatedAt: new Date() })
    .where(eq(user.id, userId))
  return mcpApiKey
}

export async function regenerateMcpApiKeyForUser(userId: string): Promise<string> {
  const mcpApiKey = generateMcpApiKey()
  await db
    .update(user)
    .set({ mcpApiKey, updatedAt: new Date() })
    .where(eq(user.id, userId))
  return mcpApiKey
}

function extractBearerToken(req: Request): string | undefined {
  const auth = req.headers.get("authorization")
  if (auth?.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length).trim()
  }
  const apiKey = req.headers.get("x-api-key")
  return apiKey?.trim() || undefined
}

export async function verifyMcpRequest(
  req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  const token = bearerToken ?? extractBearerToken(req)
  if (!token) return undefined

  const userId = await getUserIdFromMcpApiKey(token)
  if (!userId) return undefined

  return {
    token,
    clientId: userId,
    scopes: ["sites:read", "sites:write"],
    extra: { [MCP_USER_ID_KEY]: userId },
  }
}

export function getUserIdFromAuth(auth?: AuthInfo): string {
  const userId = auth?.extra?.[MCP_USER_ID_KEY]
  if (typeof userId !== "string" || !userId) {
    throw new Error("Unauthorized")
  }
  return userId
}
