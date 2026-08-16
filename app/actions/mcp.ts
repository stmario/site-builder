"use server"

import { auth } from "@/lib/auth"
import {
  ensureMcpApiKeyForUser,
  regenerateMcpApiKeyForUser,
} from "@/lib/mcp/auth"
import { getMcpEndpointUrl } from "@/lib/app-url"
import { headers } from "next/headers"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

function mcpEndpointUrl() {
  return getMcpEndpointUrl()
}

export async function getMcpConfig(): Promise<{
  hasKey: boolean
  endpointUrl: string
}> {
  await getUserId()
  return {
    hasKey: true,
    endpointUrl: mcpEndpointUrl(),
  }
}

/** Returns the user's MCP API key, creating one if needed. Only call when the user explicitly requests it. */
export async function revealMcpApiKey(): Promise<{ apiKey: string; endpointUrl: string }> {
  const userId = await getUserId()
  const apiKey = await ensureMcpApiKeyForUser(userId)
  return { apiKey, endpointUrl: mcpEndpointUrl() }
}

export async function rotateMcpApiKey(): Promise<{ apiKey: string; endpointUrl: string }> {
  const userId = await getUserId()
  const apiKey = await regenerateMcpApiKeyForUser(userId)
  return { apiKey, endpointUrl: mcpEndpointUrl() }
}
