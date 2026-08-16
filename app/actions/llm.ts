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
  const fence = out.match(/^```(?:html|json)?\s*([\s\S]*?)\s*```$/i)
  if (fence) out = fence[1].trim()
  return out
}

const PAGE_SYSTEM_PROMPT = `You are an expert front-end engineer editing a full page inside a website builder.
You are given the current HTML components on the page, site page context, and an instruction describing a change.
Return ONLY valid JSON (no markdown, no commentary) with this shape:
{
  "updates": [{ "id": "cmp_...", "html": "..." }],
  "add": [{ "label": "Section name", "html": "..." }]
}

Rules:
- "updates" — rewrite existing components by id. Include only components that should change.
- "add" — append new self-contained HTML sections when the instruction asks for new content.
- Each html value is raw HTML only: inline styles or a scoped <style> block, no <html>/<head>/<body>, no <script>.
- Preserve unchanged components by omitting them from "updates".
- Make results visually polished and responsive.

Linking between pages in this site:
- When linking to another page in the same site, use ONLY the exact href values listed under SITE PAGES.
- If PUBLISHED is yes, internal links MUST use public /s/... URLs only. NEVER use /builder/ URLs when PUBLISHED is yes.
- If PUBLISHED is no, internal links use builder URLs: /builder/{siteId}?page={slug}
- NEVER invent URLs such as page2.html, /page2, /builder/page2, or http://localhost:3000/builder/page2.html.
- NEVER use .html extensions for internal page links.
- Use relative paths exactly as provided in SITE PAGES (starting with /s/ or /builder/).
- For external websites, use full https:// URLs.`

function parsePageEditResponse(text: string): {
  updates: { id: string; html: string }[]
  add: { label: string; html: string }[]
} | null {
  try {
    const parsed = JSON.parse(stripFences(text)) as {
      updates?: { id: string; html: string }[]
      add?: { label: string; html: string }[]
    }
    return {
      updates: Array.isArray(parsed.updates) ? parsed.updates : [],
      add: Array.isArray(parsed.add) ? parsed.add : [],
    }
  } catch {
    return null
  }
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

export async function editPageWithLlm(input: {
  components: { id: string; label: string; html: string }[]
  instruction: string
  siteContext: string
}): Promise<
  | {
      updates: { id: string; html: string }[]
      add: { label: string; html: string }[]
    }
  | { error: string }
> {
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

  const componentBlock =
    input.components.length === 0
      ? "PAGE COMPONENTS: (none yet)"
      : input.components
          .map(
            (c) =>
              `[${c.id}] ${c.label}:\n${c.html || "(empty)"}`,
          )
          .join("\n\n")

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
          { role: "system", content: PAGE_SYSTEM_PROMPT },
          {
            role: "user",
            content: `${input.siteContext}\n\n${componentBlock}\n\nINSTRUCTION:\n${input.instruction}`,
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

    const parsed = parsePageEditResponse(content)
    if (!parsed) {
      return { error: "The LLM returned an invalid page edit response." }
    }

    if (parsed.updates.length === 0 && parsed.add.length === 0) {
      return { error: "The LLM did not propose any page changes." }
    }

    return parsed
  } catch (err) {
    return {
      error: `Could not reach the LLM endpoint. ${
        err instanceof Error ? err.message : "Unknown error"
      }`,
    }
  }
}
