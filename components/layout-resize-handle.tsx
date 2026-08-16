"use client"

import { useCallback, useRef } from "react"
import { cn } from "@/lib/utils"

export function LayoutResizeHandle({
  axis,
  onResize,
  onResizeEnd,
}: {
  axis: "horizontal" | "vertical"
  onResize: (delta: number) => void
  onResizeEnd?: () => void
}) {
  const dragging = useRef(false)
  const startPos = useRef(0)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragging.current = true
      startPos.current = axis === "horizontal" ? e.clientX : e.clientY
      e.currentTarget.setPointerCapture(e.pointerId)

      const handleMove = (moveEvent: PointerEvent) => {
        if (!dragging.current) return
        const current =
          axis === "horizontal" ? moveEvent.clientX : moveEvent.clientY
        const delta = current - startPos.current
        if (delta !== 0) {
          onResize(delta)
          startPos.current = current
        }
      }

      const handleUp = () => {
        dragging.current = false
        window.removeEventListener("pointermove", handleMove)
        window.removeEventListener("pointerup", handleUp)
        onResizeEnd?.()
      }

      window.addEventListener("pointermove", handleMove)
      window.addEventListener("pointerup", handleUp)
    },
    [axis, onResize, onResizeEnd],
  )

  return (
    <div
      role="separator"
      aria-orientation={axis === "horizontal" ? "vertical" : "horizontal"}
      onPointerDown={handlePointerDown}
      className={cn(
        "group z-30 shrink-0 touch-none bg-transparent transition-colors hover:bg-primary/20",
        axis === "horizontal"
          ? "w-1.5 cursor-col-resize self-stretch"
          : "h-1.5 w-full cursor-row-resize",
      )}
    >
      <div
        className={cn(
          "mx-auto rounded-full bg-border transition-colors group-hover:bg-primary group-active:bg-primary",
          axis === "horizontal" ? "h-10 w-0.5" : "h-0.5 w-10",
        )}
      />
    </div>
  )
}

export function ComponentHeightHandle({
  onResize,
}: {
  onResize: (delta: number) => void
}) {
  const dragging = useRef(false)
  const startY = useRef(0)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragging.current = true
      startY.current = e.clientY
      e.currentTarget.setPointerCapture(e.pointerId)

      const handleMove = (moveEvent: PointerEvent) => {
        if (!dragging.current) return
        const delta = moveEvent.clientY - startY.current
        if (delta !== 0) {
          onResize(delta)
          startY.current = moveEvent.clientY
        }
      }

      const handleUp = () => {
        dragging.current = false
        window.removeEventListener("pointermove", handleMove)
        window.removeEventListener("pointerup", handleUp)
      }

      window.addEventListener("pointermove", handleMove)
      window.addEventListener("pointerup", handleUp)
    },
    [onResize],
  )

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize height"
      onPointerDown={handlePointerDown}
      className="absolute inset-x-0 bottom-0 z-20 flex h-2 cursor-row-resize items-end justify-center touch-none hover:bg-primary/10"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-0.5 h-0.5 w-10 rounded-full bg-border transition-colors hover:bg-primary" />
    </div>
  )
}
