"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { llmConfig } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

export interface LlmSettings {
  baseUrl: string
  apiKey: string
  model: string
}

// Never send the stored API key back to the client. We report whether one
// exists so the UI can show a "key saved" state.
export async function getLlmConfig(): Promise<{
  baseUrl: string
  model: string
  hasKey: boolean
}> {
  const userId = await getUserId()
  const rows = await db
    .select()
    .from(llmConfig)
    .where(eq(llmConfig.userId, userId))
    .limit(1)
  const cfg = rows[0]
  return {
    baseUrl: cfg?.baseUrl ?? "",
    model: cfg?.model ?? "gpt-4o-mini",
    hasKey: Boolean(cfg?.apiKey),
  }
}

export async function saveLlmConfig(input: {
  baseUrl: string
  model: string
  apiKey?: string
}) {
  const userId = await getUserId()
  const baseUrl = input.baseUrl.trim().replace(/\/+$/, "")
  const model = input.model.trim() || "gpt-4o-mini"

  const existing = await db
    .select()
    .from(llmConfig)
    .where(eq(llmConfig.userId, userId))
    .limit(1)

  if (existing[0]) {
    await db
      .update(llmConfig)
      .set({
        baseUrl,
        model,
        // Only overwrite the key when a new one is provided.
        ...(input.apiKey && input.apiKey.trim()
          ? { apiKey: input.apiKey.trim() }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(llmConfig.userId, userId))
  } else {
    await db.insert(llmConfig).values({
      userId,
      baseUrl,
      model,
      apiKey: (input.apiKey ?? "").trim(),
    })
  }
}

const SYSTEM_PROMPT = `You are an expert front-end engineer editing a single component inside a website builder.
You are given the CURRENT HTML for one component, site page context, and an instruction describing a change.
Return ONLY the full, updated, self-contained HTML for that one component.

Rules:
- Output raw HTML only. No markdown, no code fences, no commentary, no <html>/<head>/<body> wrappers.
- Keep all styling inline (style="...") or in a scoped <style> block so the component renders standalone.
- Do not include <script> tags; they will be stripped.
- Preserve the general purpose of the component unless told otherwise.
- Make the result visually polished and responsive.

Linking between pages in this site:
- When linking to another page in the same site, use ONLY the exact href values listed under SITE PAGES.
- If PUBLISHED is yes, internal links MUST use public /s/... URLs only. NEVER use /builder/ URLs when PUBLISHED is yes.
- If PUBLISHED is no, internal links use builder URLs: /builder/{siteId}?page={slug}
- NEVER invent URLs such as page2.html, /page2, /builder/page2, or http://localhost:3000/builder/page2.html.
- NEVER use .html extensions for internal page links.
- Use relative paths exactly as provided in SITE PAGES (starting with /s/ or /builder/).
- For external websites, use full https:// URLs.
- Example public link: <a href="/s/site_abc123/about">About</a>`

function stripFences(text: string): string {
  let out = text.trim()
  const fence = out.match(/^```(?:html)?\s*([\s\S]*?)\s*```$/i)
  if (fence) out = fence[1].trim()
  return out
}

// Calls the user's own OpenAI-compatible chat completions endpoint.
export async function editComponentWithLlm(input: {
  currentHtml: string
  instruction: string
  siteContext: string
}): Promise<{ html: string } | { error: string }> {
  const userId = await getUserId()
  const rows = await db
    .select()
    .from(llmConfig)
    .where(eq(llmConfig.userId, userId))
    .limit(1)
  const cfg = rows[0]

  if (!cfg || !cfg.baseUrl || !cfg.apiKey) {
    return {
      error:
        "No LLM endpoint configured. Add your OpenAI-compatible URL and API key in Settings.",
    }
  }

  const endpoint = `${cfg.baseUrl.replace(/\/+$/, "")}/chat/completions`

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.4,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `${input.siteContext}\n\nCURRENT HTML:\n${input.currentHtml}\n\nINSTRUCTION:\n${input.instruction}`,
          },
        ],
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      return {
        error: `LLM request failed (${res.status}). ${detail.slice(0, 200)}`,
      }
    }

    const data = await res.json()
    const content: string | undefined = data?.choices?.[0]?.message?.content
    if (!content) {
      return { error: "The LLM returned an empty response." }
    }

    return { html: stripFences(content) }
  } catch (err) {
    return {
      error: `Could not reach the LLM endpoint. ${
        err instanceof Error ? err.message : "Unknown error"
      }`,
    }
  }
}
