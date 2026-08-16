"use client"

import { Fragment, useRef } from "react"
import type { SitePage, SiteRef, TreeNode } from "@/lib/tree"
import { cn } from "@/lib/utils"
import { getChildLayoutStyle, getNodeHeightStyle } from "@/lib/layout-size"
import { SiteHtmlContent } from "@/components/site-html-content"
import {
  ComponentHeightHandle,
  LayoutResizeHandle,
} from "@/components/layout-resize-handle"
import { Button } from "@/components/ui/button"
import { Columns3, FileCode2, Rows3 } from "lucide-react"

function LayoutToolbar({
  node,
  onAddHtmlChild,
  onAddContainerChild,
  onAddHtmlSibling,
  onAddContainerSibling,
}: {
  node: TreeNode
  onAddHtmlChild: (id: string) => void
  onAddContainerChild: (id: string, direction: "row" | "column") => void
  onAddHtmlSibling: (id: string) => void
  onAddContainerSibling: (id: string, direction: "row" | "column") => void
}) {
  const isContainer = node.kind === "container"
  const isRoot = node.id === "root"

  const handleClick =
    (fn: () => void) => (e: React.MouseEvent) => {
      e.stopPropagation()
      fn()
    }

  return (
    <div
      className="absolute -top-9 right-0 z-20 flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5 shadow-sm"
      onClick={(e) => e.stopPropagation()}
    >
      {isContainer && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[10px]"
            onClick={handleClick(() => onAddHtmlChild(node.id))}
            title="Add component inside"
          >
            <FileCode2 className="mr-0.5 h-3 w-3" />
            Component
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[10px]"
            onClick={handleClick(() => onAddContainerChild(node.id, "row"))}
            title="Add column inside"
          >
            <Columns3 className="mr-0.5 h-3 w-3" />
            Column
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[10px]"
            onClick={handleClick(() => onAddContainerChild(node.id, "column"))}
            title="Add row inside"
          >
            <Rows3 className="mr-0.5 h-3 w-3" />
            Row
          </Button>
        </>
      )}
      {!isRoot && (
        <>
          {isContainer && (
            <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[10px]"
            onClick={handleClick(() => onAddHtmlSibling(node.id))}
            title="Add component beside"
          >
            <FileCode2 className="mr-0.5 h-3 w-3" />+
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[10px]"
            onClick={handleClick(() => onAddContainerSibling(node.id, "row"))}
            title="Add column beside"
          >
            <Columns3 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[10px]"
            onClick={handleClick(() => onAddContainerSibling(node.id, "column"))}
            title="Add row beside"
          >
            <Rows3 className="h-3 w-3" />
          </Button>
        </>
      )}
    </div>
  )
}

export function CanvasNode({
  node,
  selectedId,
  onSelect,
  site,
  pages,
  onNavigatePage,
  onAddHtmlChild,
  onAddContainerChild,
  onAddHtmlSibling,
  onAddContainerSibling,
  onResizeAdjacent,
  onResizeHeight,
}: {
  node: TreeNode
  selectedId: string | null
  onSelect: (id: string) => void
  site?: SiteRef
  pages?: SitePage[]
  onNavigatePage?: (pageId: string) => void
  onAddHtmlChild?: (id: string) => void
  onAddContainerChild?: (id: string, direction: "row" | "column") => void
  onAddHtmlSibling?: (id: string) => void
  onAddContainerSibling?: (id: string, direction: "row" | "column") => void
  onResizeAdjacent?: (
    parentId: string,
    leftId: string,
    rightId: string,
    delta: number,
  ) => void
  onResizeHeight?: (id: string, delta: number) => void
}) {
  const isSelected = node.id === selectedId
  const containerRef = useRef<HTMLDivElement>(null)
  const hasLayoutActions =
    onAddHtmlChild &&
    onAddContainerChild &&
    onAddHtmlSibling &&
    onAddContainerSibling

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(node.id)
  }

  if (node.kind === "html") {
    return (
      <div
        data-node-id={node.id}
        onClick={handleClick}
        style={getNodeHeightStyle(node)}
        className={cn(
          "relative cursor-pointer outline-offset-2 transition-shadow",
          isSelected
            ? "outline outline-2 outline-primary"
            : "hover:outline hover:outline-1 hover:outline-primary/40",
        )}
      >
        {isSelected && (
          <>
            <span className="absolute -top-5 left-0 z-10 rounded-t bg-primary px-1.5 py-0.5 font-mono text-[10px] leading-none text-primary-foreground">
              {node.id}
            </span>
            {hasLayoutActions && (
              <LayoutToolbar
                node={node}
                onAddHtmlChild={onAddHtmlChild}
                onAddContainerChild={onAddContainerChild}
                onAddHtmlSibling={onAddHtmlSibling}
                onAddContainerSibling={onAddContainerSibling}
              />
            )}
            {onResizeHeight && (
              <ComponentHeightHandle
                onResize={(delta) => onResizeHeight(node.id, delta)}
              />
            )}
          </>
        )}
        {/* Sanitized LLM-authored HTML for this component. */}
        <SiteHtmlContent
          html={node.html ?? ""}
          site={site}
          pages={pages}
          onNavigatePage={onNavigatePage}
        />
      </div>
    )
  }

  // Container node.
  const children = node.children ?? []
  const layoutName = node.direction === "row" ? "column" : "row"
  const isHorizontal = node.direction === "row"
  return (
    <div
      ref={containerRef}
      data-node-id={node.id}
      onClick={handleClick}
      style={getNodeHeightStyle(node)}
      className={cn(
        "relative flex min-h-16 gap-0 transition-shadow",
        node.direction === "row" ? "flex-row" : "flex-col",
        isSelected
          ? "outline outline-2 outline-primary"
          : "hover:outline hover:outline-1 hover:outline-primary/30",
      )}
    >
      {isSelected && (
        <>
          <span className="absolute -top-5 left-0 z-10 rounded-t bg-primary px-1.5 py-0.5 font-mono text-[10px] leading-none text-primary-foreground">
            {node.id} · {layoutName}
          </span>
          {hasLayoutActions && (
            <LayoutToolbar
              node={node}
              onAddHtmlChild={onAddHtmlChild}
              onAddContainerChild={onAddContainerChild}
              onAddHtmlSibling={onAddHtmlSibling}
              onAddContainerSibling={onAddContainerSibling}
            />
          )}
          {onResizeHeight && (
            <ComponentHeightHandle
              onResize={(delta) => onResizeHeight(node.id, delta)}
            />
          )}
        </>
      )}
      {children.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 border border-dashed border-muted-foreground/30 bg-muted/30 py-10 text-xs text-muted-foreground">
          <span>Empty {layoutName}</span>
          {hasLayoutActions && (
            <div className="flex flex-wrap items-center justify-center gap-1">
              <Button
                variant="secondary"
                size="sm"
                className="h-7"
                onClick={(e) => {
                  e.stopPropagation()
                  onAddHtmlChild(node.id)
                }}
              >
                <FileCode2 className="mr-1 h-3.5 w-3.5" />
                Component
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-7"
                onClick={(e) => {
                  e.stopPropagation()
                  onAddContainerChild(node.id, "row")
                }}
              >
                <Columns3 className="mr-1 h-3.5 w-3.5" />
                Column
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-7"
                onClick={(e) => {
                  e.stopPropagation()
                  onAddContainerChild(node.id, "column")
                }}
              >
                <Rows3 className="mr-1 h-3.5 w-3.5" />
                Row
              </Button>
            </div>
          )}
        </div>
      ) : (
        children.map((child, index) => {
          const previous = index > 0 ? children[index - 1] : null
          return (
            <Fragment key={child.id}>
              {previous && onResizeAdjacent && (
                <LayoutResizeHandle
                  axis={isHorizontal ? "horizontal" : "vertical"}
                  onResize={(deltaPx) => {
                    const delta =
                      isHorizontal && containerRef.current
                        ? (deltaPx /
                            containerRef.current.getBoundingClientRect().width) *
                          100
                        : deltaPx
                    onResizeAdjacent(node.id, previous.id, child.id, delta)
                  }}
                />
              )}
              <div style={getChildLayoutStyle(child, node.direction, children)}>
                <CanvasNode
                  node={child}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  site={site}
                  pages={pages}
                  onNavigatePage={onNavigatePage}
                  onAddHtmlChild={onAddHtmlChild}
                  onAddContainerChild={onAddContainerChild}
                  onAddHtmlSibling={onAddHtmlSibling}
                  onAddContainerSibling={onAddContainerSibling}
                  onResizeAdjacent={onResizeAdjacent}
                  onResizeHeight={onResizeHeight}
                />
              </div>
            </Fragment>
          )
        })
      )}
    </div>
  )
}
