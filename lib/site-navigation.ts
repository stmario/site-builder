import type { SitePage, SiteRef } from "@/lib/tree"

function matchesSiteParam(site: SiteRef, param: string): boolean {
  return param === site.id || (!!site.slug && param === site.slug)
}

/** Returns a page slug or id when href points at this site; otherwise null (external/other). */
export function parseInternalPageTarget(
  site: SiteRef,
  pages: Pick<SitePage, "id" | "slug">[],
  href: string,
  origin?: string,
): string | null {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return null
  }

  let url: URL
  try {
    url = new URL(href, origin ?? "http://localhost")
  } catch {
    return null
  }

  if (origin && (href.startsWith("http://") || href.startsWith("https://"))) {
    if (url.origin !== origin) return null
  }

  const builderMatch = url.pathname.match(/^\/builder\/([^/]+)$/)
  if (builderMatch?.[1] === site.id) {
    const pageParam = url.searchParams.get("page")
    if (pageParam) return decodeURIComponent(pageParam)
    return null
  }

  const publicMatch = url.pathname.match(/^\/s\/([^/]+)(?:\/([^/]+))?$/)
  if (publicMatch && matchesSiteParam(site, publicMatch[1])) {
    if (publicMatch[2]) return decodeURIComponent(publicMatch[2])
    return pages[0]?.slug ?? null
  }

  return null
}

export function findPageByParam(
  pages: SitePage[],
  param: string,
): SitePage | undefined {
  return pages.find((p) => p.slug === param || p.id === param)
}
