"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { saveSiteDocument, publishSite, unpublishSite, updateSiteSlug } from "@/app/actions/sites"
import {
  type SiteDocument,
  type SitePage,
  type SiteRef,
  type SiteTree,
  type TreeNode,
  formatPagesContextForLlm,
  pageHref,
  publicPageHref,
  publicSiteHomeHref,
  rewriteDocumentLinksForPublic,
  sitePublicPath,
  createContainer,
  createHtmlNode,
  findNode,
  findParent,
  insertChild,
  insertSiblingAfter,
  moveNodeDown,
  moveNodeUp,
  removeNode,
  resizeAdjacentChildren,
  setChildLayoutSize,
  slugify,
  starterPage,
  updateNode,
  wrapNodeInContainer,
} from "@/lib/tree"
import { clampHeight, getInspectorHeightValue } from "@/lib/layout-size"
import { LayersPanel } from "@/components/layers-panel"
import { CanvasNode } from "@/components/canvas-node"
import { InspectorPanel } from "@/components/inspector-panel"
import { PreviewTree } from "@/components/preview-tree"
import { LlmSettingsDialog, type LlmState } from "@/components/llm-settings-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ChevronLeft,
  Settings2,
  Eye,
  PenLine,
  Check,
  Loader2,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Globe,
  ExternalLink,
  Copy,
  Link2,
} from "lucide-react"
import { toast } from "sonner"
import {
  normalizeSiteSlug,
  validateSiteSlug,
} from "@/lib/site-slugs"

const STARTER_HTML = `<section style="padding:40px 32px;font-family:sans-serif;color:#1a1a1a;background:#f7f7fb;text-align:center">
  <h2 style="margin:0 0 8px;font-size:24px">New component</h2>
  <p style="margin:0;color:#555">Select me and chat to rewrite this block.</p>
</section>`

type SaveStatus = "saved" | "saving" | "dirty"

function buildDocument(
  pages: SitePage[],
  activePageId: string,
  tree: SiteTree,
): SiteDocument {
  return {
    pages: pages.map((p) => (p.id === activePageId ? { ...p, tree } : p)),
  }
}

function syncActivePageTree(
  pages: SitePage[],
  activePageId: string,
  tree: SiteTree,
): SitePage[] {
  return pages.map((p) => (p.id === activePageId ? { ...p, tree } : p))
}

export function BuilderClient({
  siteId,
  siteSlug: initialSiteSlug,
  siteName,
  initialDocument,
  initialPageId,
  initialPublished,
  llm: initialLlm,
}: {
  siteId: string
  siteSlug: string | null
  siteName: string
  initialDocument: SiteDocument
  initialPageId: string
  initialPublished: boolean
  llm: LlmState
}) {
  const initialPage =
    initialDocument.pages.find((p) => p.id === initialPageId) ??
    initialDocument.pages[0]

  const [pages, setPages] = useState<SitePage[]>(initialDocument.pages)
  const [activePageId, setActivePageId] = useState(initialPage.id)
  const [tree, setTree] = useState<SiteTree>(initialPage.tree)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [llm, setLlm] = useState(initialLlm)
  const [preview, setPreview] = useState(false)
  const [published, setPublished] = useState(initialPublished)
  const [publishing, setPublishing] = useState(false)
  const [status, setStatus] = useState<SaveStatus>("saved")
  const [renamePageId, setRenamePageId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [renameSlugValue, setRenameSlugValue] = useState("")
  const [siteSlug, setSiteSlug] = useState(initialSiteSlug ?? "")
  const [siteUrlOpen, setSiteUrlOpen] = useState(false)
  const [siteUrlValue, setSiteUrlValue] = useState(initialSiteSlug ?? "")
  const [savingSiteUrl, setSavingSiteUrl] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstRender = useRef(true)
  const pagesRef = useRef(pages)
  const activePageIdRef = useRef(activePageId)

  pagesRef.current = pages
  activePageIdRef.current = activePageId

  const selectedNode = selectedId ? findNode(tree.root, selectedId) : null
  const selectedParent = selectedId
    ? findParent(tree.root, selectedId)
    : null

  const siteRef: SiteRef = { id: siteId, slug: siteSlug || null }

  const updatePageUrl = useCallback(
    (page: SitePage) => {
      window.history.replaceState(null, "", pageHref(siteId, page))
    },
    [siteId],
  )

  const siteContext = formatPagesContextForLlm(
    siteRef,
    pages,
    activePageId,
    published,
  )

  const previewRoot = published
    ? (rewriteDocumentLinksForPublic(
        siteRef,
        buildDocument(pages, activePageId, tree),
      ).pages.find((p) => p.id === activePageId)?.tree.root ?? tree.root)
    : tree.root

  const copyPublicUrl = async () => {
    try {
      const url = `${window.location.origin}${publicSiteHomeHref(siteRef)}`
      await navigator.clipboard.writeText(url)
      toast.success("Public URL copied.")
    } catch {
      toast.error("Could not copy URL.")
    }
  }

  const handlePublish = async () => {
    setPublishing(true)
    try {
      const document = buildDocument(pages, activePageId, tree)
      await publishSite(siteId, document)
      setPublished(true)
      toast.success("Site published.")
    } catch {
      toast.error("Could not publish site.")
    } finally {
      setPublishing(false)
    }
  }

  const handleUnpublish = async () => {
    setPublishing(true)
    try {
      await unpublishSite(siteId)
      setPublished(false)
      toast.success("Site unpublished.")
    } catch {
      toast.error("Could not unpublish site.")
    } finally {
      setPublishing(false)
    }
  }

  // Debounced autosave whenever the active page tree or page list changes.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    setStatus("dirty")
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setStatus("saving")
      try {
        const document = buildDocument(
          pagesRef.current,
          activePageIdRef.current,
          tree,
        )
        await saveSiteDocument(siteId, document)
        setPages(document.pages)
        setStatus("saved")
      } catch {
        setStatus("dirty")
      }
    }, 900)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [tree, pages, siteId])

  const mutate = useCallback(
    (fn: (root: TreeNode) => TreeNode) => {
      setTree((prev) => ({ root: fn(prev.root) }))
    },
    [],
  )

  const switchPage = (pageId: string) => {
    if (pageId === activePageId) return

    const syncedPages = syncActivePageTree(pages, activePageId, tree)
    const nextPage = syncedPages.find((p) => p.id === pageId)
    if (!nextPage) return

    setPages(syncedPages)
    setActivePageId(pageId)
    setTree(nextPage.tree)
    setSelectedId(null)
    firstRender.current = true
    updatePageUrl(nextPage)
  }

  const handleAddPage = () => {
    const syncedPages = syncActivePageTree(pages, activePageId, tree)
    const page = starterPage(`Page ${syncedPages.length + 1}`)
    const nextPages = [...syncedPages, page]

    setPages(nextPages)
    setActivePageId(page.id)
    setTree(page.tree)
    setSelectedId(null)
    firstRender.current = true
    updatePageUrl(page)
  }

  const handleDeletePage = (pageId: string) => {
    if (pages.length <= 1) return

    let syncedPages = syncActivePageTree(pages, activePageId, tree)
    syncedPages = syncedPages.filter((p) => p.id !== pageId)
    setPages(syncedPages)

    if (activePageId === pageId) {
      const nextPage = syncedPages[0]
      setActivePageId(nextPage.id)
      setTree(nextPage.tree)
      setSelectedId(null)
      firstRender.current = true
      updatePageUrl(nextPage)
    }
  }

  const openRenameDialog = (page: SitePage) => {
    setRenamePageId(page.id)
    setRenameValue(page.name)
    setRenameSlugValue(page.slug)
  }

  const handleRenamePage = () => {
    if (!renamePageId) return
    const trimmed = renameValue.trim()
    if (!trimmed) return
    const nextSlug = slugify(renameSlugValue.trim() || trimmed)
    if (!nextSlug) {
      toast.error("Page URL slug is required.")
      return
    }
    const duplicate = pages.some(
      (p) => p.id !== renamePageId && p.slug === nextSlug,
    )
    if (duplicate) {
      toast.error("Another page already uses that URL slug.")
      return
    }

    setPages((prev) =>
      prev.map((p) =>
        p.id === renamePageId
          ? { ...p, name: trimmed, slug: nextSlug }
          : p,
      ),
    )
    if (renamePageId === activePageId) {
      updatePageUrl({ slug: nextSlug })
    }
    setRenamePageId(null)
    setRenameValue("")
    setRenameSlugValue("")
  }

  const handleSaveSiteUrl = async () => {
    const normalized = normalizeSiteSlug(siteUrlValue)
    const validationError = validateSiteSlug(normalized)
    if (validationError) {
      toast.error(validationError)
      return
    }
    setSavingSiteUrl(true)
    try {
      const result = await updateSiteSlug(siteId, normalized)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      setSiteSlug(result.slug)
      setSiteUrlValue(result.slug)
      setSiteUrlOpen(false)
      toast.success("Site URL updated.")
    } catch {
      toast.error("Could not update site URL.")
    } finally {
      setSavingSiteUrl(false)
    }
  }

  const handleAddHtmlChild = (parentId: string) => {
    const child = createHtmlNode(STARTER_HTML, "Component")
    mutate((root) => insertChild(root, parentId, child))
    setSelectedId(child.id)
  }

  const handleAddContainerChild = (
    parentId: string,
    direction: "row" | "column",
  ) => {
    const child = createContainer(direction)
    mutate((root) => insertChild(root, parentId, child))
    setSelectedId(child.id)
  }

  const handleAddHtmlSibling = (nodeId: string) => {
    const child = createHtmlNode(STARTER_HTML, "Component")
    mutate((root) => insertSiblingAfter(root, nodeId, child))
    setSelectedId(child.id)
  }

  const handleAddContainerSibling = (
    nodeId: string,
    direction: "row" | "column",
  ) => {
    const child = createContainer(direction)
    mutate((root) => insertSiblingAfter(root, nodeId, child))
    setSelectedId(child.id)
  }

  const handleWrapInContainer = (
    nodeId: string,
    direction: "row" | "column",
  ) => {
    let wrapperId: string | null = null
    mutate((root) => {
      const result = wrapNodeInContainer(root, nodeId, direction)
      wrapperId = result.wrapperId
      return result.root
    })
    if (wrapperId) setSelectedId(wrapperId)
  }

  const handleDelete = (id: string) => {
    mutate((root) => removeNode(root, id))
    if (selectedId === id) setSelectedId(null)
  }

  const handleRelabel = (id: string, label: string) => {
    mutate((root) => updateNode(root, id, (n) => ({ ...n, label })))
  }

  const handleApplyHtml = (id: string, html: string) => {
    mutate((root) => updateNode(root, id, (n) => ({ ...n, html })))
  }

  const handleSetDirection = (id: string, direction: "row" | "column") => {
    mutate((root) =>
      updateNode(root, id, (n) =>
        n.kind === "container" ? { ...n, direction } : n,
      ),
    )
  }

  const handleResizeAdjacent = (
    parentId: string,
    leftId: string,
    rightId: string,
    delta: number,
  ) => {
    mutate((root) => resizeAdjacentChildren(root, parentId, leftId, rightId, delta))
  }

  const handleSetLayoutSize = (
    parentId: string,
    childId: string,
    value: number,
  ) => {
    mutate((root) => setChildLayoutSize(root, parentId, childId, value))
  }

  const handleSetHeight = (id: string, value: number) => {
    mutate((root) =>
      updateNode(root, id, (n) => ({
        ...n,
        height: clampHeight(value),
        layoutSize: n.layoutSize != null && n.layoutSize > 100 ? undefined : n.layoutSize,
      })),
    )
  }

  const handleClearHeight = (id: string) => {
    mutate((root) =>
      updateNode(root, id, (n) => ({
        ...n,
        height: undefined,
      })),
    )
  }

  const handleResizeHeight = (id: string, delta: number) => {
    mutate((root) => {
      const node = findNode(root, id)
      if (!node) return root
      const current = getInspectorHeightValue(node)
      return updateNode(root, id, (n) => ({
        ...n,
        height: clampHeight(current + delta),
        layoutSize: n.layoutSize != null && n.layoutSize > 100 ? undefined : n.layoutSize,
      }))
    })
  }

  return (
    <div className="flex h-svh flex-col bg-background">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "h-8",
            )}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Sites
          </Link>
          <div className="h-4 w-px bg-border" />
          <span className="text-sm font-medium text-foreground">
            {siteName}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 font-mono text-[11px] text-muted-foreground"
            onClick={() => {
              setSiteUrlValue(siteSlug)
              setSiteUrlOpen(true)
            }}
          >
            <Link2 className="mr-1.5 h-3.5 w-3.5" />
            /s/{siteSlug || siteId}
          </Button>
          <SaveIndicator status={status} />
        </div>

        <div className="flex items-center gap-1.5">
          <Badge
            variant={llm.hasKey ? "secondary" : "outline"}
            className="font-mono text-[10px]"
          >
            {llm.hasKey ? llm.model : "no LLM"}
          </Badge>
          <LlmSettingsDialog
            llm={llm}
            onSaved={setLlm}
            trigger={
              <Button variant="ghost" size="sm" className="h-8">
                <Settings2 className="mr-1.5 h-4 w-4" />
                LLM
              </Button>
            }
          />
          <Button
            variant={preview ? "default" : "outline"}
            size="sm"
            className="h-8"
            onClick={() => {
              setPreview((p) => !p)
              setSelectedId(null)
            }}
          >
            {preview ? (
              <>
                <PenLine className="mr-1.5 h-4 w-4" />
                Edit
              </>
            ) : (
              <>
                <Eye className="mr-1.5 h-4 w-4" />
                Preview
              </>
            )}
          </Button>
          {published ? (
            <>
              <Badge variant="secondary" className="font-mono text-[10px]">
                Live
              </Badge>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={copyPublicUrl}
              >
                <Copy className="mr-1.5 h-4 w-4" />
                Copy URL
              </Button>
              <a
                href={publicSiteHomeHref(siteRef)}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "h-8",
                )}
              >
                <ExternalLink className="mr-1.5 h-4 w-4" />
                View live
              </a>
              <Button
                size="sm"
                className="h-8"
                onClick={handlePublish}
                disabled={publishing}
              >
                {publishing ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Globe className="mr-1.5 h-4 w-4" />
                )}
                Update live
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={handleUnpublish}
                disabled={publishing}
              >
                Unpublish
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              className="h-8"
              onClick={handlePublish}
              disabled={publishing}
            >
              {publishing ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Globe className="mr-1.5 h-4 w-4" />
              )}
              Publish
            </Button>
          )}
        </div>
      </header>

      {/* Page tabs */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/30 px-4 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {pages.map((page) => (
            <div key={page.id} className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => switchPage(page.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  page.id === activePageId
                    ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                )}
              >
                {page.name}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "icon-sm" }),
                        "h-7 w-7 text-muted-foreground",
                      )}
                    />
                  }
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => openRenameDialog(page)}>
                    <Pencil className="h-4 w-4" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={pages.length <= 1}
                    onClick={() => handleDeletePage(page.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0"
          onClick={handleAddPage}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Add page
        </Button>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* Layers */}
        {!preview && (
          <aside className="hidden w-60 shrink-0 border-r border-border bg-card md:block">
            <LayersPanel
              root={tree.root}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </aside>
        )}

        {/* Canvas */}
        <main
          className="flex-1 overflow-auto bg-muted/40 p-6"
          onClick={() => !preview && setSelectedId(null)}
        >
          <div
            className={cn(
              "mx-auto min-h-full max-w-4xl bg-white shadow-sm",
              !preview && "ring-1 ring-border",
            )}
          >
            {preview ? (
              <PreviewTree
                root={previewRoot}
                site={siteRef}
                pages={pages}
                onNavigatePage={switchPage}
              />
            ) : (
              <div className="p-2">
                <CanvasNode
                  node={tree.root}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  site={siteRef}
                  pages={pages}
                  onNavigatePage={switchPage}
                  onAddHtmlChild={handleAddHtmlChild}
                  onAddContainerChild={handleAddContainerChild}
                  onAddHtmlSibling={handleAddHtmlSibling}
                  onAddContainerSibling={handleAddContainerSibling}
                  onResizeAdjacent={handleResizeAdjacent}
                  onResizeHeight={handleResizeHeight}
                />
              </div>
            )}
          </div>
        </main>

        {/* Inspector */}
        {!preview && (
          <aside className="hidden w-80 shrink-0 border-l border-border bg-card lg:block">
            <InspectorPanel
              node={selectedNode}
              parentNode={selectedParent}
              hasLlm={llm.hasKey}
              siteContext={siteContext}
              onAddHtmlChild={handleAddHtmlChild}
              onAddContainerChild={handleAddContainerChild}
              onAddHtmlSibling={handleAddHtmlSibling}
              onAddContainerSibling={handleAddContainerSibling}
              onWrapInContainer={handleWrapInContainer}
              onSetDirection={handleSetDirection}
              onSetLayoutSize={handleSetLayoutSize}
              onSetHeight={handleSetHeight}
              onClearHeight={handleClearHeight}
              onDelete={handleDelete}
              onMoveUp={(id) => mutate((root) => moveNodeUp(root, id))}
              onMoveDown={(id) => mutate((root) => moveNodeDown(root, id))}
              onRelabel={handleRelabel}
              onApplyHtml={handleApplyHtml}
            />
          </aside>
        )}
      </div>

      <Dialog
        open={renamePageId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenamePageId(null)
            setRenameValue("")
            setRenameSlugValue("")
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Page settings</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="page-name">Page name</Label>
              <Input
                id="page-name"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="page-slug">Page URL slug</Label>
              <Input
                id="page-slug"
                value={renameSlugValue}
                onChange={(e) => setRenameSlugValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenamePage()
                }}
                className="font-mono text-sm"
              />
              <p className="font-mono text-[11px] text-muted-foreground">
                {publicPageHref(siteRef, { slug: slugify(renameSlugValue || renameValue || "page") })}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamePageId(null)}>
              Cancel
            </Button>
            <Button onClick={handleRenamePage}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={siteUrlOpen} onOpenChange={setSiteUrlOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Site URL</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="site-slug">Public URL slug</Label>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm text-muted-foreground">/s/</span>
              <Input
                id="site-slug"
                value={siteUrlValue}
                onChange={(e) => setSiteUrlValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveSiteUrl()
                }}
                className="font-mono text-sm"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Use lowercase letters, numbers, and hyphens. Home page:{" "}
              <span className="font-mono">{sitePublicPath({ id: siteId, slug: normalizeSiteSlug(siteUrlValue) || siteSlug })}</span>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSiteUrlOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSiteUrl} disabled={savingSiteUrl}>
              {savingSiteUrl ? "Saving..." : "Save URL"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "saving")
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving
      </span>
    )
  if (status === "dirty")
    return <span className="text-xs text-muted-foreground">Unsaved</span>
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Check className="h-3 w-3" />
      Saved
    </span>
  )
}
