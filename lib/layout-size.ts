import type { CSSProperties } from "react"
import type { TreeNode } from "@/lib/tree"

export const HEIGHT_MIN = 80
export const HEIGHT_MAX = 800
export const HEIGHT_DEFAULT = 240
export const HEIGHT_STEP = 10

const MIN_HORIZONTAL_SHARE = 10

/** Explicit height for any node (component or container). */
export function getNodeHeightStyle(node: TreeNode): CSSProperties {
  const height = node.height ?? legacyHeight(node)
  if (height == null) return {}
  return {
    minHeight: height,
    height,
    overflow: "auto",
  }
}

function legacyHeight(node: TreeNode): number | undefined {
  if (node.layoutSize == null || node.layoutSize <= 100) return undefined
  return node.layoutSize
}

export function heightLabel(node: TreeNode): string {
  const height = node.height ?? legacyHeight(node)
  return height != null ? `${Math.round(height)}px` : "Auto"
}

export function getInspectorHeightValue(node: TreeNode): number {
  return node.height ?? legacyHeight(node) ?? HEIGHT_DEFAULT
}

/** Styles for a child slot inside a layout container. */
export function getChildLayoutStyle(
  child: TreeNode,
  parentDirection: "row" | "column" | undefined,
  siblings: TreeNode[],
): CSSProperties {
  if (parentDirection === "row") {
    const hasSizes = siblings.some((s) => s.layoutSize != null)
    if (!hasSizes) {
      return { flex: "1 1 0%", minWidth: 0 }
    }
    const total = siblings.reduce((sum, s) => sum + (s.layoutSize ?? 0), 0)
    const share = child.layoutSize ?? 100 / siblings.length
    const percent = total > 0 ? (share / total) * 100 : 100 / siblings.length
    return { flex: `0 0 ${percent}%`, minWidth: 0 }
  }

  return { width: "100%", flex: "0 0 auto" }
}

export function layoutSizeLabel(
  child: TreeNode,
  parentDirection: "row" | "column" | undefined,
  siblings: TreeNode[],
): string {
  if (parentDirection !== "row") return heightLabel(child)

  const hasSizes = siblings.some((s) => s.layoutSize != null)
  if (!hasSizes) {
    return `${Math.round(100 / siblings.length)}%`
  }
  const total = siblings.reduce((sum, s) => sum + (s.layoutSize ?? 0), 0)
  const share = child.layoutSize ?? 100 / siblings.length
  const percent = total > 0 ? (share / total) * 100 : 100 / siblings.length
  return `${Math.round(percent)}%`
}

function ensureHorizontalShares(children: TreeNode[]): TreeNode[] {
  if (children.some((c) => c.layoutSize != null)) return children
  const equal = Math.round((100 / children.length) * 10) / 10
  return children.map((c) => ({ ...c, layoutSize: equal }))
}

function effectiveHeight(node: TreeNode): number {
  return node.height ?? legacyHeight(node) ?? HEIGHT_DEFAULT
}

/** Drag-resize between two horizontal columns (parent direction === "row"). */
export function resizeHorizontalSiblings(
  children: TreeNode[],
  leftId: string,
  rightId: string,
  deltaPercent: number,
): TreeNode[] {
  const sized = ensureHorizontalShares(children)
  const leftIdx = sized.findIndex((c) => c.id === leftId)
  const rightIdx = sized.findIndex((c) => c.id === rightId)
  if (leftIdx === -1 || rightIdx !== leftIdx + 1) return children

  const left = sized[leftIdx]
  const right = sized[rightIdx]
  const leftShare = left.layoutSize ?? MIN_HORIZONTAL_SHARE
  const rightShare = right.layoutSize ?? MIN_HORIZONTAL_SHARE

  const nextLeft = Math.max(
    MIN_HORIZONTAL_SHARE,
    Math.min(100 - MIN_HORIZONTAL_SHARE, leftShare + deltaPercent),
  )
  const nextRight = Math.max(
    MIN_HORIZONTAL_SHARE,
    Math.min(100 - MIN_HORIZONTAL_SHARE, rightShare - deltaPercent),
  )

  return sized.map((c, i) => {
    if (i === leftIdx) return { ...c, layoutSize: nextLeft }
    if (i === rightIdx) return { ...c, layoutSize: nextRight }
    return c
  })
}

/** Drag-resize height between two stacked siblings. */
export function resizeVerticalSiblings(
  children: TreeNode[],
  topId: string,
  bottomId: string,
  deltaPx: number,
): TreeNode[] {
  const topIdx = children.findIndex((c) => c.id === topId)
  const bottomIdx = children.findIndex((c) => c.id === bottomId)
  if (topIdx === -1 || bottomIdx !== topIdx + 1) return children

  const top = children[topIdx]
  const bottom = children[bottomIdx]
  const topHeight = effectiveHeight(top)
  const bottomHeight = effectiveHeight(bottom)

  const nextTop = Math.max(HEIGHT_MIN, topHeight + deltaPx)
  const nextBottom = Math.max(HEIGHT_MIN, bottomHeight - deltaPx)

  return children.map((c, i) => {
    if (i === topIdx) return { ...c, height: nextTop, layoutSize: undefined }
    if (i === bottomIdx) return { ...c, height: nextBottom, layoutSize: undefined }
    return c
  })
}

/** Set column width share from the inspector slider. */
export function setChildLayoutSizeInParent(
  children: TreeNode[],
  childId: string,
  value: number,
  parentDirection: "row" | "column",
): TreeNode[] {
  if (parentDirection !== "row") return children

  const idx = children.findIndex((c) => c.id === childId)
  if (idx === -1) return children

  const sized = ensureHorizontalShares(children)
  const clamped = Math.max(
    MIN_HORIZONTAL_SHARE,
    Math.min(100 - MIN_HORIZONTAL_SHARE, value),
  )
  const others = sized.filter((_, i) => i !== idx)
  const remaining = 100 - clamped
  const othersTotal = others.reduce((sum, c) => sum + (c.layoutSize ?? 0), 0)

  return sized.map((c, i) => {
    if (i === idx) return { ...c, layoutSize: clamped }
    if (othersTotal <= 0) {
      return { ...c, layoutSize: remaining / others.length }
    }
    const proportion = (c.layoutSize ?? 0) / othersTotal
    return {
      ...c,
      layoutSize: Math.round(remaining * proportion * 10) / 10,
    }
  })
}

export function clampHeight(value: number): number {
  return Math.max(HEIGHT_MIN, Math.min(HEIGHT_MAX, Math.round(value)))
}

export function getInspectorLayoutSizeValue(
  child: TreeNode,
  parentDirection: "row" | "column",
  siblings: TreeNode[],
): number {
  if (parentDirection !== "row") return getInspectorHeightValue(child)

  const hasSizes = siblings.some((s) => s.layoutSize != null)
  if (!hasSizes) return Math.round(100 / siblings.length)
  const total = siblings.reduce((sum, s) => sum + (s.layoutSize ?? 0), 0)
  const share = child.layoutSize ?? 100 / siblings.length
  return total > 0
    ? Math.round((share / total) * 100)
    : Math.round(100 / siblings.length)
}

export function getInspectorLayoutSizeRange(
  parentDirection: "row" | "column",
): { min: number; max: number; step: number; unit: string } | null {
  if (parentDirection !== "row") return null
  return { min: 10, max: 90, step: 1, unit: "%" }
}
