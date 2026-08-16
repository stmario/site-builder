"use server"

import { auth } from "@/lib/auth"
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
  newId,
  sitePublicSegment,
  rewriteDocumentLinksForPublic,
  type SiteDocument,
  type SiteRef,
  type SiteTree,
} from "@/lib/tree"
import { and, desc, eq, ne, or } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

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

function revalidatePublicSite(site: SiteRef, previousSlug?: string | null) {
  revalidatePath(`/s/${sitePublicSegment(site)}`)
  if (previousSlug && previousSlug !== site.slug) {
    revalidatePath(`/s/${previousSlug}`)
  }
  revalidatePath(`/s/${site.id}`)
}

export async function listSites() {
  const userId = await getUserId()
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

export async function createSite(
  name: string,
  templateId: SiteTemplateId = "default",
) {
  const userId = await getUserId()
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
  revalidatePath("/dashboard")
  return id
}

export async function getSite(id: string) {
  const userId = await getUserId()
  const rows = await db
    .select()
    .from(site)
    .where(and(eq(site.id, id), eq(site.userId, userId)))
    .limit(1)
  return rows[0] ?? null
}

export async function getPublishedSite(siteParam: string) {
  const rows = await db
    .select({
      id: site.id,
      name: site.name,
      slug: site.slug,
      publishedTree: site.publishedTree,
      publishedAt: site.publishedAt,
    })
    .from(site)
    .where(
      and(
        eq(site.published, true),
        or(eq(site.id, siteParam), eq(site.slug, siteParam)),
      ),
    )
    .limit(1)
  return rows[0] ?? null
}

export async function saveSiteDocument(id: string, document: SiteDocument) {
  const userId = await getUserId()
  await db
    .update(site)
    .set({ tree: document, updatedAt: new Date() })
    .where(and(eq(site.id, id), eq(site.userId, userId)))
  revalidatePath(`/builder/${id}`)
}

/** @deprecated Use saveSiteDocument — kept for compatibility */
export async function saveSiteTree(id: string, tree: SiteTree) {
  await saveSiteDocument(id, {
    pages: [{ id: "page_home", name: "Home", slug: "home", tree }],
  })
}

export async function updateSiteSlug(
  id: string,
  slugInput: string,
): Promise<{ slug: string } | { error: string }> {
  const userId = await getUserId()
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

  const siteRef = { id, slug }
  revalidatePublicSite(siteRef, current.slug)
  revalidatePath(`/builder/${id}`)
  revalidatePath("/dashboard")
  return { slug }
}

export async function publishSite(id: string, document: SiteDocument) {
  const userId = await getUserId()
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

  revalidatePublicSite(siteRef)
  revalidatePath(`/builder/${id}`)
  revalidatePath("/dashboard")
}

export async function unpublishSite(id: string) {
  const userId = await getUserId()
  const rows = await db
    .select({ slug: site.slug })
    .from(site)
    .where(and(eq(site.id, id), eq(site.userId, userId)))
    .limit(1)
  const row = rows[0]
  if (!row) throw new Error("Site not found")

  await db
    .update(site)
    .set({ published: false, updatedAt: new Date() })
    .where(and(eq(site.id, id), eq(site.userId, userId)))

  revalidatePublicSite({ id, slug: row.slug })
  revalidatePath(`/builder/${id}`)
  revalidatePath("/dashboard")
}

export async function renameSite(id: string, name: string) {
  const userId = await getUserId()
  const trimmed = name.trim() || "Untitled site"
  await db
    .update(site)
    .set({ name: trimmed, updatedAt: new Date() })
    .where(and(eq(site.id, id), eq(site.userId, userId)))

  const rows = await db
    .select({ slug: site.slug })
    .from(site)
    .where(eq(site.id, id))
    .limit(1)
  if (rows[0]) revalidatePublicSite({ id, slug: rows[0].slug })
  revalidatePath("/dashboard")
}

export async function deleteSite(id: string) {
  const userId = await getUserId()
  const rows = await db
    .select({ slug: site.slug })
    .from(site)
    .where(and(eq(site.id, id), eq(site.userId, userId)))
    .limit(1)

  await db.delete(site).where(and(eq(site.id, id), eq(site.userId, userId)))
  revalidatePath("/dashboard")
  if (rows[0]) revalidatePublicSite({ id, slug: rows[0].slug })
}

/** Ensure legacy sites get a slug the first time they are opened. */
export async function ensureSiteSlug(id: string): Promise<string | null> {
  const userId = await getUserId()
  const rows = await db
    .select({ id: site.id, name: site.name, slug: site.slug })
    .from(site)
    .where(and(eq(site.id, id), eq(site.userId, userId)))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  if (row.slug) return row.slug

  const slug = await generateUniqueSiteSlug(row.name, row.id)
  await db
    .update(site)
    .set({ slug, updatedAt: new Date() })
    .where(eq(site.id, row.id))
  return slug
}
