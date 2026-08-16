"use client"

import { useState, useRef, useEffect } from "react"
import type { TreeNode } from "@/lib/tree"
import {
  getInspectorHeightValue,
  getInspectorLayoutSizeRange,
  getInspectorLayoutSizeValue,
  heightLabel,
  HEIGHT_MAX,
  HEIGHT_MIN,
  HEIGHT_STEP,
  layoutSizeLabel,
} from "@/lib/layout-size"
import { editComponentWithLlm } from "@/app/actions/llm"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Rows3,
  Columns3,
  FileCode2,
  SendHorizonal,
  Sparkles,
  Undo2,
} from "lucide-react"
import { toast } from "sonner"

export interface ChatMessage {
  role: "user" | "assistant" | "system"
  text: string
}

export function InspectorPanel({
  node,
  parentNode,
  hasLlm,
  siteContext,
  onAddHtmlChild,
  onAddContainerChild,
  onAddHtmlSibling,
  onAddContainerSibling,
  onWrapInContainer,
  onSetDirection,
  onSetLayoutSize,
  onSetHeight,
  onClearHeight,
  onDelete,
  onMoveUp,
  onMoveDown,
  onRelabel,
  onApplyHtml,
}: {
  node: TreeNode | null
  parentNode: TreeNode | null
  hasLlm: boolean
  siteContext: string
  onAddHtmlChild: (id: string) => void
  onAddContainerChild: (id: string, direction: "row" | "column") => void
  onAddHtmlSibling: (id: string) => void
  onAddContainerSibling: (id: string, direction: "row" | "column") => void
  onWrapInContainer: (id: string, direction: "row" | "column") => void
  onSetDirection: (id: string, direction: "row" | "column") => void
  onSetLayoutSize: (parentId: string, childId: string, value: number) => void
  onSetHeight: (id: string, value: number) => void
  onClearHeight: (id: string) => void
  onDelete: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
  onRelabel: (id: string, label: string) => void
  onApplyHtml: (id: string, html: string) => void
}) {
  const [instruction, setInstruction] = useState("")
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [prevHtml, setPrevHtml] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Reset the transcript when the selection changes.
  useEffect(() => {
    setMessages([])
    setPrevHtml(null)
    setInstruction("")
  }, [node?.id])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  if (!node) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <FileCode2 className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Select a component on the canvas or in the Layers panel to edit it.
        </p>
      </div>
    )
  }

  const isRoot = node.id === "root"
  const isContainer = node.kind === "container"
  const layoutParent =
    parentNode?.kind === "container" ? parentNode : null
  const layoutSiblings = layoutParent?.children ?? []
  const parentDirection = layoutParent?.direction ?? "column"
  const sizeRange = layoutParent
    ? getInspectorLayoutSizeRange(parentDirection)
    : null
  const sizeValue = layoutParent
    ? getInspectorLayoutSizeValue(node, parentDirection, layoutSiblings)
    : 0
  const heightValue = getInspectorHeightValue(node)
  const hasExplicitHeight = node.height != null

  const runEdit = async () => {
    if (!instruction.trim() || node.kind !== "html") return
    if (!hasLlm) {
      toast.error("Configure your LLM endpoint first.")
      return
    }
    const prompt = instruction.trim()
    setMessages((m) => [...m, { role: "user", text: prompt }])
    setInstruction("")
    setBusy(true)
    try {
      const result = await editComponentWithLlm({
        currentHtml: node.html ?? "",
        instruction: prompt,
        siteContext,
      })
      if ("error" in result) {
        setMessages((m) => [...m, { role: "system", text: result.error }])
        toast.error("LLM edit failed.")
      } else {
        setPrevHtml(node.html ?? "")
        onApplyHtml(node.id, result.html)
        setMessages((m) => [
          ...m,
          { role: "assistant", text: "Updated the component." },
        ])
      }
    } finally {
      setBusy(false)
    }
  }

  const undo = () => {
    if (prevHtml === null) return
    onApplyHtml(node.id, prevHtml)
    setPrevHtml(null)
    setMessages((m) => [...m, { role: "system", text: "Reverted last edit." }])
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          {isContainer ? (
            node.direction === "row" ? (
              <Columns3 className="h-4 w-4 text-primary" />
            ) : (
              <Rows3 className="h-4 w-4 text-primary" />
            )
          ) : (
            <FileCode2 className="h-4 w-4 text-primary" />
          )}
          <span className="text-sm font-semibold text-foreground">
            {isRoot ? "Page" : isContainer ? "Container" : "Component"}
          </span>
        </div>
        <p className="mt-1 select-all font-mono text-[11px] text-muted-foreground">
          {node.id}
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {/* Structure controls */}
        <div className="space-y-3 p-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Label
            </label>
            <Input
              value={node.label}
              onChange={(e) => onRelabel(node.id, e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {!isRoot && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => onMoveUp(node.id)}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => onMoveDown(node.id)}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-destructive hover:text-destructive"
                  onClick={() => onDelete(node.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>

          {layoutParent && sizeRange && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  Column width
                </p>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {layoutSizeLabel(node, parentDirection, layoutSiblings)}
                </span>
              </div>
              <Input
                type="range"
                min={sizeRange.min}
                max={sizeRange.max}
                step={sizeRange.step}
                value={sizeValue}
                onChange={(e) =>
                  onSetLayoutSize(
                    layoutParent.id,
                    node.id,
                    Number(e.target.value),
                  )
                }
                className="h-8 cursor-pointer"
              />
              <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                <span>
                  {sizeRange.min}
                  {sizeRange.unit}
                </span>
                <span>
                  {sizeRange.max}
                  {sizeRange.unit}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Height</p>
              <span className="font-mono text-[11px] text-muted-foreground">
                {heightLabel(node)}
              </span>
            </div>
            <Input
              type="range"
              min={HEIGHT_MIN}
              max={HEIGHT_MAX}
              step={HEIGHT_STEP}
              value={heightValue}
              onChange={(e) => onSetHeight(node.id, Number(e.target.value))}
              className="h-8 cursor-pointer"
            />
            <div className="flex items-center justify-between">
              <div className="flex justify-between gap-4 font-mono text-[10px] text-muted-foreground">
                <span>{HEIGHT_MIN}px</span>
                <span>{HEIGHT_MAX}px</span>
              </div>
              {hasExplicitHeight && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => onClearHeight(node.id)}
                >
                  Auto
                </Button>
              )}
            </div>
          </div>

          {isContainer && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                {isRoot ? "Page layout" : "Layout"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant={node.direction === "row" ? "default" : "outline"}
                  size="sm"
                  className="h-7"
                  onClick={() => onSetDirection(node.id, "row")}
                >
                  <Columns3 className="mr-1 h-3.5 w-3.5" />
                  Column
                </Button>
                <Button
                  variant={node.direction !== "row" ? "default" : "outline"}
                  size="sm"
                  className="h-7"
                  onClick={() => onSetDirection(node.id, "column")}
                >
                  <Rows3 className="mr-1 h-3.5 w-3.5" />
                  Row
                </Button>
              </div>
            </div>
          )}

          {isContainer && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Add inside
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7"
                  onClick={() => onAddHtmlChild(node.id)}
                >
                  <FileCode2 className="mr-1 h-3.5 w-3.5" />
                  Component
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7"
                  onClick={() => onAddContainerChild(node.id, "row")}
                >
                  <Columns3 className="mr-1 h-3.5 w-3.5" />
                  Column
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7"
                  onClick={() => onAddContainerChild(node.id, "column")}
                >
                  <Rows3 className="mr-1 h-3.5 w-3.5" />
                  Row
                </Button>
              </div>
            </div>
          )}

          {!isRoot && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Add beside
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7"
                  onClick={() => onAddHtmlSibling(node.id)}
                >
                  <FileCode2 className="mr-1 h-3.5 w-3.5" />
                  Component
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7"
                  onClick={() => onAddContainerSibling(node.id, "row")}
                >
                  <Columns3 className="mr-1 h-3.5 w-3.5" />
                  Column
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7"
                  onClick={() => onAddContainerSibling(node.id, "column")}
                >
                  <Rows3 className="mr-1 h-3.5 w-3.5" />
                  Row
                </Button>
              </div>
            </div>
          )}

          {node.kind === "html" && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Wrap in layout
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  onClick={() => onWrapInContainer(node.id, "row")}
                >
                  <Columns3 className="mr-1 h-3.5 w-3.5" />
                  Column
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  onClick={() => onWrapInContainer(node.id, "column")}
                >
                  <Rows3 className="mr-1 h-3.5 w-3.5" />
                  Row
                </Button>
              </div>
            </div>
          )}
        </div>

        {node.kind === "html" && (
          <>
            <Separator />
            {/* Chat transcript */}
            <div className="space-y-2 p-4">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Edit with chat
                </span>
              </div>

              {messages.length === 0 ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Describe a change — e.g.{" "}
                  <span className="text-foreground">
                    &quot;add a link to Page 2 in the nav&quot;
                  </span>
                  . Internal page links must use the builder URLs from your
                  site&apos;s page list.
                </p>
              ) : (
                <ul className="space-y-2">
                  {messages.map((m, i) => (
                    <li
                      key={i}
                      className={
                        m.role === "user"
                          ? "ml-6 rounded-lg rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground"
                          : m.role === "assistant"
                            ? "mr-6 rounded-lg rounded-bl-sm bg-secondary px-3 py-2 text-sm text-secondary-foreground"
                            : "rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground"
                      }
                    >
                      {m.text}
                    </li>
                  ))}
                </ul>
              )}

              {prevHtml !== null && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={undo}
                >
                  <Undo2 className="mr-1 h-3.5 w-3.5" />
                  Undo last edit
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Chat input */}
      {node.kind === "html" && (
        <div className="border-t border-border p-3">
          {!hasLlm && (
            <p className="mb-2 text-xs text-destructive">
              No LLM configured — set one up from the top bar.
            </p>
          )}
          <div className="flex items-end gap-2">
            <Input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing &&
                  e.keyCode !== 229
                ) {
                  e.preventDefault()
                  runEdit()
                }
              }}
              placeholder="Describe the change..."
              disabled={busy}
              className="text-sm"
            />
            <Button
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={runEdit}
              disabled={busy || !instruction.trim()}
              aria-label="Send instruction"
            >
              {busy ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
              ) : (
                <SendHorizonal className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
