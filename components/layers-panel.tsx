"use client"

import type { TreeNode } from "@/lib/tree"
import { cn } from "@/lib/utils"
import { Box, Rows3, Columns3, FileCode2 } from "lucide-react"

function NodeRow({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: TreeNode
  depth: number
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const isSelected = node.id === selectedId
  const Icon =
    node.kind === "html"
      ? FileCode2
      : node.direction === "row"
        ? Columns3
        : Rows3

  return (
    <>
      <button
        onClick={() => onSelect(node.id)}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        className={cn(
          "flex w-full items-center gap-2 py-1.5 pr-2 text-left text-xs transition-colors",
          isSelected
            ? "bg-primary/15 text-foreground"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        )}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate font-medium">{node.label}</span>
        <span className="ml-auto shrink-0 font-mono text-[10px] opacity-60">
          {node.id === "root" ? "root" : node.id.split("_")[1]?.slice(0, 4)}
        </span>
      </button>
      {node.children?.map((child) => (
        <NodeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </>
  )
}

export function LayersPanel({
  root,
  selectedId,
  onSelect,
}: {
  root: TreeNode
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Box className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Layers
        </span>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        <NodeRow
          node={root}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      </div>
    </div>
  )
}
