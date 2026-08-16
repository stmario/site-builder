"use client"

import { useEffect, useRef } from "react"
import { sanitizeHtml } from "@/lib/sanitize"
import type { SitePage, SiteRef } from "@/lib/tree"
import { findPageByParam, parseInternalPageTarget } from "@/lib/site-navigation"
import { cn } from "@/lib/utils"

export function SiteHtmlContent({
  html,
  site,
  pages,
  onNavigatePage,
  className,
  onClick,
}: {
  html: string
  site?: SiteRef
  pages?: SitePage[]
  onNavigatePage?: (pageId: string) => void
  className?: string
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !site || !pages || !onNavigatePage) return

    const handler = (e: MouseEvent) => {
      const anchor = (e.target as Element | null)?.closest("a")
      if (!anchor) return

      const href = anchor.getAttribute("href")
      if (!href) return

      const pageParam = parseInternalPageTarget(
        site,
        pages,
        href,
        window.location.origin,
      )

      if (pageParam) {
        const page = findPageByParam(pages, pageParam)
        if (!page) return
        e.preventDefault()
        e.stopPropagation()
        onNavigatePage(page.id)
        return
      }

      if (
        !href.startsWith("#") &&
        !href.startsWith("mailto:") &&
        !href.startsWith("tel:")
      ) {
        // External link — navigate normally without selecting the component.
        e.stopPropagation()
      }
    }

    el.addEventListener("click", handler)
    return () => el.removeEventListener("click", handler)
  }, [site, pages, onNavigatePage, html])

  return (
    <div
      ref={ref}
      className={cn(className)}
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  )
}
