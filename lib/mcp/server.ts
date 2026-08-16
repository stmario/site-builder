import type { McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"
import { editComponentWithLlmForUser } from "@/lib/llm-service"
import { getUserIdFromAuth } from "@/lib/mcp/auth"
import {
  collectHtmlComponents,
  createSiteForUser,
  formatSiteContextForLlm,
  getComponentFromDocument,
  getSiteForUser,
  listSitesForUser,
  publishSiteForUser,
  saveSiteDocumentForUser,
  updateComponentHtmlInDocument,
} from "@/lib/sites-service"
import type { SiteDocument } from "@/lib/tree"

function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  }
}

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  }
}

function userIdFromCtx(ctx: { http?: { authInfo?: import("@modelcontextprotocol/server").AuthInfo } }) {
  return getUserIdFromAuth(ctx.http?.authInfo)
}

export function registerSiteEditingTools(server: McpServer) {
  server.registerTool(
    "list_sites",
    {
      title: "List sites",
      description:
        "List all websites owned by the authenticated user. Returns id, name, slug, published status, and updatedAt.",
      inputSchema: z.object({}),
    },
    async (_args, ctx) => {
      const userId = userIdFromCtx(ctx)
      const sites = await listSitesForUser(userId)
      return jsonResult(sites)
    },
  )

  server.registerTool(
    "get_site",
    {
      title: "Get site",
      description:
        "Fetch a full site document including all pages and the component tree. Use list_components to find editable HTML block IDs.",
      inputSchema: z.object({
        siteId: z.string().describe("The site id (e.g. site_abc123)."),
      }),
    },
    async ({ siteId }, ctx) => {
      const userId = userIdFromCtx(ctx)
      const siteRow = await getSiteForUser(userId, siteId)
      if (!siteRow) return errorResult(`Site "${siteId}" not found.`)
      return jsonResult({
        id: siteRow.id,
        name: siteRow.name,
        slug: siteRow.slug,
        published: siteRow.published,
        publishedAt: siteRow.publishedAt,
        updatedAt: siteRow.updatedAt,
        document: siteRow.tree,
      })
    },
  )

  server.registerTool(
    "list_components",
    {
      title: "List components",
      description:
        "List all editable HTML components in a site with their ids, labels, page, and a short HTML preview.",
      inputSchema: z.object({
        siteId: z.string().describe("The site id."),
      }),
    },
    async ({ siteId }, ctx) => {
      const userId = userIdFromCtx(ctx)
      const siteRow = await getSiteForUser(userId, siteId)
      if (!siteRow) return errorResult(`Site "${siteId}" not found.`)

      const components = siteRow.tree.pages.flatMap((page) =>
        collectHtmlComponents(page.tree.root, page.slug, page.name),
      )
      return jsonResult({ siteId, components })
    },
  )

  server.registerTool(
    "get_component",
    {
      title: "Get component HTML",
      description: "Get the full HTML for a single component by id.",
      inputSchema: z.object({
        siteId: z.string().describe("The site id."),
        componentId: z.string().describe("The component id (e.g. cmp_abc123)."),
        pageSlug: z
          .string()
          .optional()
          .describe("Optional page slug when the id appears on multiple pages."),
      }),
    },
    async ({ siteId, componentId, pageSlug }, ctx) => {
      const userId = userIdFromCtx(ctx)
      const siteRow = await getSiteForUser(userId, siteId)
      if (!siteRow) return errorResult(`Site "${siteId}" not found.`)

      const match = getComponentFromDocument(
        siteRow.tree,
        componentId,
        pageSlug,
      )
      if (!match) {
        return errorResult(`Component "${componentId}" not found.`)
      }
      if (match.node.kind !== "html") {
        return errorResult(`Node "${componentId}" is not an HTML component.`)
      }

      return jsonResult({
        siteId,
        componentId,
        label: match.node.label,
        pageSlug: match.page.slug,
        pageName: match.page.name,
        html: match.node.html ?? "",
      })
    },
  )

  server.registerTool(
    "update_component_html",
    {
      title: "Update component HTML",
      description:
        "Replace the HTML of a single component. HTML is sanitized before saving. Does not publish — call publish_site to go live.",
      inputSchema: z.object({
        siteId: z.string().describe("The site id."),
        componentId: z.string().describe("The component id to update."),
        html: z.string().describe("The new HTML for the component."),
        pageSlug: z
          .string()
          .optional()
          .describe("Optional page slug when the id appears on multiple pages."),
      }),
    },
    async ({ siteId, componentId, html, pageSlug }, ctx) => {
      const userId = userIdFromCtx(ctx)
      const siteRow = await getSiteForUser(userId, siteId)
      if (!siteRow) return errorResult(`Site "${siteId}" not found.`)

      const updated = updateComponentHtmlInDocument(
        siteRow.tree,
        componentId,
        html,
        pageSlug,
      )
      if ("error" in updated) return errorResult(updated.error)

      await saveSiteDocumentForUser(userId, siteId, updated)
      return jsonResult({
        ok: true,
        siteId,
        componentId,
        message: "Component updated. Call publish_site to make changes live.",
      })
    },
  )

  server.registerTool(
    "edit_component_with_llm",
    {
      title: "Edit component with LLM",
      description:
        "Use the user's configured OpenAI-compatible LLM to rewrite a component based on a natural-language instruction. Saves the result automatically.",
      inputSchema: z.object({
        siteId: z.string().describe("The site id."),
        componentId: z.string().describe("The component id to edit."),
        instruction: z
          .string()
          .describe("Natural-language instruction describing the desired change."),
        pageSlug: z
          .string()
          .optional()
          .describe("Optional page slug when the id appears on multiple pages."),
      }),
    },
    async ({ siteId, componentId, instruction, pageSlug }, ctx) => {
      const userId = userIdFromCtx(ctx)
      const siteRow = await getSiteForUser(userId, siteId)
      if (!siteRow) return errorResult(`Site "${siteId}" not found.`)

      const match = getComponentFromDocument(
        siteRow.tree,
        componentId,
        pageSlug,
      )
      if (!match) {
        return errorResult(`Component "${componentId}" not found.`)
      }
      if (match.node.kind !== "html") {
        return errorResult(`Node "${componentId}" is not an HTML component.`)
      }

      const siteContext = formatSiteContextForLlm(
        siteRow,
        siteRow.tree,
        match.page.id,
      )
      const llmResult = await editComponentWithLlmForUser(userId, {
        currentHtml: match.node.html ?? "",
        instruction,
        siteContext,
      })
      if ("error" in llmResult) return errorResult(llmResult.error)

      const updated = updateComponentHtmlInDocument(
        siteRow.tree,
        componentId,
        llmResult.html,
        pageSlug,
      )
      if ("error" in updated) return errorResult(updated.error)

      await saveSiteDocumentForUser(userId, siteId, updated)
      return jsonResult({
        ok: true,
        siteId,
        componentId,
        html: llmResult.html,
        message: "Component updated via LLM. Call publish_site to go live.",
      })
    },
  )

  server.registerTool(
    "save_site_document",
    {
      title: "Save site document",
      description:
        "Replace the entire site document (all pages and component trees). Use for bulk structural changes. Prefer update_component_html for single-block edits.",
      inputSchema: z.object({
        siteId: z.string().describe("The site id."),
        document: z
          .record(z.string(), z.unknown())
          .describe("Full SiteDocument object with a pages array."),
      }),
    },
    async ({ siteId, document }, ctx) => {
      const userId = userIdFromCtx(ctx)
      const siteRow = await getSiteForUser(userId, siteId)
      if (!siteRow) return errorResult(`Site "${siteId}" not found.`)

      await saveSiteDocumentForUser(userId, siteId, document as SiteDocument)
      return jsonResult({
        ok: true,
        siteId,
        message: "Site saved. Call publish_site to make changes live.",
      })
    },
  )

  server.registerTool(
    "publish_site",
    {
      title: "Publish site",
      description:
        "Publish the current draft site to its public URL at /s/{slug}. Optionally pass an updated document to publish in one step.",
      inputSchema: z.object({
        siteId: z.string().describe("The site id."),
        document: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("Optional document to save before publishing."),
      }),
    },
    async ({ siteId, document }, ctx) => {
      const userId = userIdFromCtx(ctx)
      const siteRow = await getSiteForUser(userId, siteId)
      if (!siteRow) return errorResult(`Site "${siteId}" not found.`)

      const doc = (document ?? siteRow.tree) as SiteDocument
      if (document) {
        await saveSiteDocumentForUser(userId, siteId, doc)
      }

      const result = await publishSiteForUser(userId, siteId, doc)
      return jsonResult({
        ok: true,
        siteId,
        publicUrl: result.publicUrl,
        publishedAt: result.publishedAt,
      })
    },
  )

  server.registerTool(
    "create_site",
    {
      title: "Create site",
      description: "Create a new website from a starter template.",
      inputSchema: z.object({
        name: z.string().describe("Display name for the new site."),
        templateId: z
          .enum(["default", "blog"])
          .optional()
          .describe("Starter template. Defaults to default."),
      }),
    },
    async ({ name, templateId }, ctx) => {
      const userId = userIdFromCtx(ctx)
      const siteId = await createSiteForUser(userId, name, templateId ?? "default")
      return jsonResult({ ok: true, siteId, builderUrl: `/builder/${siteId}` })
    },
  )
}
