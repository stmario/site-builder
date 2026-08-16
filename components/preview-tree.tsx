"use client"

import type { SitePage, SiteRef, TreeNode } from "@/lib/tree"
import { cn } from "@/lib/utils"
import { getChildLayoutStyle, getNodeHeightStyle } from "@/lib/layout-size"
import { SiteHtmlContent } from "@/components/site-html-content"

export function PreviewTree({
  root,
  site,
  pages,
  onNavigatePage,
}: {
  root: TreeNode
  site?: SiteRef
  pages?: SitePage[]
  onNavigatePage?: (pageId: string) => void
}) {
  if (root.kind === "html") {
    return (
      <div style={getNodeHeightStyle(root)}>
        <SiteHtmlContent
          html={root.html ?? ""}
          site={site}
          pages={pages}
          onNavigatePage={onNavigatePage}
        />
      </div>
    )
  }

  const children = root.children ?? []
  return (
    <div
      style={getNodeHeightStyle(root)}
      className={cn("flex", root.direction === "row" ? "flex-row" : "flex-col")}
    >
      {children.map((child) => (
        <div
          key={child.id}
          style={getChildLayoutStyle(child, root.direction, children)}
        >
          <PreviewTree
            root={child}
            site={site}
            pages={pages}
            onNavigatePage={onNavigatePage}
          />
        </div>
      ))}
    </div>
  )
}
