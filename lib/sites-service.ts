import { db } from "@/lib/db"
import { site } from "@/lib/db/schema"
import {
  normalizeSiteSlug,
  validateSiteSlug,
} from "@/lib/site-slugs"
import {
  createDocumentFromTemplate,
  type SiteTemplateId,
} from "@/lib/templates"
import {
  findNode,
  formatPagesContextForLlm,
  newId,
  normalizeSiteDocument,
  rewriteDocumentLinksForPublic,
  sitePublicSegment,
  updateNode,
  type SiteDocument,
  type SiteRef,
  type SiteTree,
  type TreeNode,
} from "@/lib/tree"
import { sanitizeHtml } from "@/lib/sanitize.server"
import { and, desc, eq, ne } from "drizzle-orm"

async function generateUniqueSiteSlug(name: string, excludeId?: string) {
  let base = normalizeSiteSlug(name) || "site"
  if (base === "site") base = "my-site"

  let candidate = base
  let suffix = 2
  while (true) {
    const rows = await db
      .select({ id: site.id })
      .from(site)
      .where(eq(site.slug, candidate))
      .limit(1)
    if (!rows[0] || rows[0].id === excludeId) return candidate
    candidate = `${base}-${suffix++}`
  }
}

export async function listSitesForUser(userId: string) {
  return db
    .select({
      id: site.id,
      name: site.name,
      slug: site.slug,
      updatedAt: site.updatedAt,
      published: site.published,
      publishedAt: site.publishedAt,
    })
    .from(site)
    .where(eq(site.userId, userId))
    .orderBy(desc(site.updatedAt))
}

export async function createSiteForUser(
  userId: string,
  name: string,
  templateId: SiteTemplateId = "default",
) {
  const id = newId("site")
  const trimmed = name.trim() || "Untitled site"
  const slug = await generateUniqueSiteSlug(trimmed)
  await db.insert(site).values({
    id,
    userId,
    name: trimmed,
    slug,
    tree: createDocumentFromTemplate(templateId),
  })
  return id
}

export async function getSiteForUser(userId: string, id: string) {
  const rows = await db
    .select()
    .from(site)
    .where(and(eq(site.id, id), eq(site.userId, userId)))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return {
    ...row,
    tree: normalizeSiteDocument(row.tree),
  }
}

export async function saveSiteDocumentForUser(
  userId: string,
  id: string,
  document: SiteDocument,
) {
  await db
    .update(site)
    .set({ tree: document, updatedAt: new Date() })
    .where(and(eq(site.id, id), eq(site.userId, userId)))
}

export async function publishSiteForUser(
  userId: string,
  id: string,
  document: SiteDocument,
) {
  const rows = await db
    .select({ slug: site.slug })
    .from(site)
    .where(and(eq(site.id, id), eq(site.userId, userId)))
    .limit(1)
  const row = rows[0]
  if (!row) throw new Error("Site not found")

  const siteRef: SiteRef = { id, slug: row.slug }
  const now = new Date()
  const publicDocument = rewriteDocumentLinksForPublic(siteRef, document)
  await db
    .update(site)
    .set({
      tree: document,
      published: true,
      publishedAt: now,
      publishedTree: publicDocument,
      updatedAt: now,
    })
    .where(and(eq(site.id, id), eq(site.userId, userId)))

  return {
    publicUrl: `/s/${sitePublicSegment(siteRef)}`,
    publishedAt: now.toISOString(),
  }
}

export async function updateSiteSlugForUser(
  userId: string,
  id: string,
  slugInput: string,
): Promise<{ slug: string } | { error: string }> {
  const slug = normalizeSiteSlug(slugInput)
  const validationError = validateSiteSlug(slug)
  if (validationError) return { error: validationError }

  const rows = await db
    .select({ slug: site.slug })
    .from(site)
    .where(and(eq(site.id, id), eq(site.userId, userId)))
    .limit(1)
  const current = rows[0]
  if (!current) return { error: "Site not found." }

  const taken = await db
    .select({ id: site.id })
    .from(site)
    .where(and(eq(site.slug, slug), ne(site.id, id)))
    .limit(1)
  if (taken[0]) return { error: "That URL is already taken." }

  await db
    .update(site)
    .set({ slug, updatedAt: new Date() })
    .where(and(eq(site.id, id), eq(site.userId, userId)))

  return { slug }
}

export function collectHtmlComponents(
  node: TreeNode,
  pageSlug: string,
  pageName: string,
  out: Array<{
    id: string
    label: string
    pageSlug: string
    pageName: string
    htmlPreview: string
  }> = [],
) {
  if (node.kind === "html") {
    const html = node.html ?? ""
    out.push({
      id: node.id,
      label: node.label,
      pageSlug,
      pageName,
      htmlPreview: html.slice(0, 200) + (html.length > 200 ? "…" : ""),
    })
  }
  for (const child of node.children ?? []) {
    collectHtmlComponents(child, pageSlug, pageName, out)
  }
  return out
}

export function getComponentFromDocument(
  document: SiteDocument,
  componentId: string,
  pageSlug?: string,
) {
  for (const page of document.pages) {
    if (pageSlug && page.slug !== pageSlug) continue
    const node = findNode(page.tree.root, componentId)
    if (node) {
      return { page, node }
    }
  }
  return null
}

export function updateComponentHtmlInDocument(
  document: SiteDocument,
  componentId: string,
  html: string,
  pageSlug?: string,
): SiteDocument | { error: string } {
  const match = getComponentFromDocument(document, componentId, pageSlug)
  if (!match) {
    return { error: `Component "${componentId}" not found.` }
  }
  if (match.node.kind !== "html") {
    return { error: `Node "${componentId}" is not an HTML component.` }
  }

  const sanitized = sanitizeHtml(html)
  return {
    pages: document.pages.map((page) =>
      page.id === match.page.id
        ? {
            ...page,
            tree: {
              root: updateNode(page.tree.root, componentId, (node) => ({
                ...node,
                html: sanitized,
              })),
            },
          }
        : page,
    ),
  }
}

export function formatSiteContextForLlm(
  siteRow: { id: string; slug: string | null; published: boolean },
  document: SiteDocument,
  pageId?: string,
) {
  const activePageId = pageId ?? document.pages[0]?.id ?? ""
  return formatPagesContextForLlm(
    { id: siteRow.id, slug: siteRow.slug },
    document.pages,
    activePageId,
    siteRow.published,
  )
}

/** @deprecated Use saveSiteDocumentForUser */
export async function saveSiteTreeForUser(
  userId: string,
  id: string,
  tree: SiteTree,
) {
  await saveSiteDocumentForUser(userId, id, {
    pages: [{ id: "page_home", name: "Home", slug: "home", tree }],
  })
}
