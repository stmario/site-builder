import { slugify } from "@/lib/tree"

export const RESERVED_SITE_SLUGS = new Set([
  "api",
  "builder",
  "dashboard",
  "sign-in",
  "sign-up",
  "s",
  "_next",
  "admin",
  "www",
])

export function normalizeSiteSlug(input: string): string {
  return slugify(input).slice(0, 48)
}

export function validateSiteSlug(slug: string): string | null {
  if (!slug) return "URL slug is required."
  if (slug.length < 2) return "URL slug must be at least 2 characters."
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return "Use lowercase letters, numbers, and hyphens only."
  }
  if (RESERVED_SITE_SLUGS.has(slug)) return "That URL slug is reserved."
  return null
}
