// The freeform component tree. Every node has a unique ID.
// A node either renders raw HTML (a "leaf" produced/edited by the LLM) or
// acts as a layout container that holds child nodes.

import {
  resizeHorizontalSiblings,
  resizeVerticalSiblings,
  setChildLayoutSizeInParent,
} from "./layout-size"

export type NodeKind = "container" | "html"

export interface TreeNode {
  id: string
  kind: NodeKind
  // Human label shown in the layers panel.
  label: string
  // For kind === "html": the raw HTML markup for this component.
  html?: string
  // For kind === "container": layout direction + child nodes.
  direction?: "row" | "column"
  children?: TreeNode[]
  // Share of parent main axis: width % in row containers.
  layoutSize?: number
  // Explicit height in px. Undefined = size to content.
  height?: number
}

export interface SiteTree {
  root: TreeNode
}

export interface SitePage {
  id: string
  name: string
  slug: string
  tree: SiteTree
}

export interface SiteDocument {
  pages: SitePage[]
}

export type SiteRef = { id: string; slug?: string | null }

export function sitePublicSegment(site: SiteRef): string {
  return site.slug || site.id
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "page"
  )
}

export function normalizeSiteDocument(raw: unknown): SiteDocument {
  if (
    raw &&
    typeof raw === "object" &&
    "pages" in raw &&
    Array.isArray((raw as SiteDocument).pages) &&
    (raw as SiteDocument).pages.length > 0
  ) {
    return raw as SiteDocument
  }

  if (raw && typeof raw === "object" && "root" in raw) {
    return {
      pages: [
        {
          id: "page_home",
          name: "Home",
          slug: "home",
          tree: raw as SiteTree,
        },
      ],
    }
  }

  return starterDocument()
}

export function newPageTree(): SiteTree {
  return {
    root: {
      id: "root",
      kind: "container",
      label: "Page",
      direction: "column",
      children: [
        createHtmlNode(
          `<section style="padding:40px 32px;font-family:sans-serif;color:#1a1a1a;background:#f7f7fb;text-align:center">
  <h2 style="margin:0 0 8px;font-size:24px">New page</h2>
  <p style="margin:0;color:#555">Select me and chat to rewrite this block.</p>
</section>`,
          "Component",
        ),
      ],
    },
  }
}

export function starterPage(name = "Home"): SitePage {
  return {
    id: newId("page"),
    name,
    slug: slugify(name),
    tree: name === "Home" ? starterTree() : newPageTree(),
  }
}

export function starterDocument(): SiteDocument {
  return { pages: [starterPage("Home")] }
}

/** Builder URL for a page — use this in `<a href>` while editing. */
export function pageHref(siteId: string, page: Pick<SitePage, "slug">): string {
  return `/builder/${siteId}?page=${encodeURIComponent(page.slug)}`
}

/** Public URL for a published page. */
export function publicPageHref(
  site: SiteRef,
  page: Pick<SitePage, "slug">,
  isHome = false,
): string {
  const base = sitePublicPath(site)
  if (isHome || page.slug === "home") return base
  return `${base}/${encodeURIComponent(page.slug)}`
}

export function publicSiteHomeHref(site: SiteRef): string {
  return sitePublicPath(site)
}

export function sitePublicPath(site: SiteRef): string {
  return `/s/${sitePublicSegment(site)}`
}

export function resolvePageParam(
  pages: SitePage[],
  param: string | undefined,
): SitePage {
  if (param) {
    const bySlug = pages.find((p) => p.slug === param)
    if (bySlug) return bySlug
    const byId = pages.find((p) => p.id === param)
    if (byId) return byId
  }
  return pages[0]
}

export function formatPagesContextForLlm(
  site: SiteRef,
  pages: SitePage[],
  activePageId: string,
  published = false,
): string {
  const active = pages.find((p) => p.id === activePageId) ?? pages[0]
  const homePage = pages[0]
  const lines = pages.map((p) => {
    const href = published
      ? publicPageHref(site, p, p.id === homePage.id)
      : pageHref(site.id, p)
    return `- ${p.name}: href="${href}" (slug: ${p.slug}, id: ${p.id})`
  })
  const linkNote = published
    ? "Use the public href values below for internal links."
    : "Use the builder href values below for internal links (publish the site to get public URLs)."
  return `SITE ID: ${site.id}
SITE URL SLUG: ${sitePublicSegment(site)}
CURRENT PAGE: ${active.name} (slug: ${active.slug})
PUBLISHED: ${published ? "yes" : "no"}
SITE PAGES (${linkNote}):
${lines.join("\n")}`
}

function replaceAllLiteral(text: string, from: string, to: string): string {
  if (!from || from === to) return text
  return text.split(from).join(to)
}

function rewriteHtmlLinksForPublic(
  site: SiteRef,
  pages: SitePage[],
  html: string,
): string {
  const homePageId = pages[0]?.id
  let out = html

  for (const page of pages) {
    const isHome = page.id === homePageId
    const publicLink = publicPageHref(site, page, isHome)
    const builderLinks = new Set([
      pageHref(site.id, page),
      `/builder/${site.id}?page=${page.slug}`,
      `/builder/${site.id}?page=${encodeURIComponent(page.slug)}`,
      `/builder/${site.id}?page=${page.id}`,
      publicPageHref({ id: site.id, slug: null }, page, isHome),
      `/s/${site.id}/${page.slug}`,
      `/s/${site.id}/${encodeURIComponent(page.slug)}`,
      `/s/${site.id}`,
    ])

    for (const builderLink of builderLinks) {
      out = replaceAllLiteral(out, builderLink, publicLink)
      out = out.replace(
        new RegExp(`https?:\\/\\/[^"'\\s>]+${escapeRegExp(builderLink)}`, "gi"),
        publicLink,
      )
    }
  }

  return out
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function rewriteNodeLinksForPublic(
  site: SiteRef,
  pages: SitePage[],
  node: TreeNode,
): TreeNode {
  if (node.kind === "html" && node.html) {
    return {
      ...node,
      html: rewriteHtmlLinksForPublic(site, pages, node.html),
    }
  }
  if (!node.children) return node
  return {
    ...node,
    children: node.children.map((child) =>
      rewriteNodeLinksForPublic(site, pages, child),
    ),
  }
}

/** Rewrite builder page links to public /s/... URLs across a site document. */
export function rewriteDocumentLinksForPublic(
  site: SiteRef,
  document: SiteDocument,
): SiteDocument {
  return {
    pages: document.pages.map((page) => ({
      ...page,
      tree: {
        root: rewriteNodeLinksForPublic(site, document.pages, page.tree.root),
      },
    })),
  }
}

// ── ID generation ──────────────────────────────────────────────────
// Short, URL-safe, collision-resistant enough for client-side use.
export function newId(prefix = "cmp"): string {
  const rand = Math.random().toString(36).slice(2, 8)
  const time = Date.now().toString(36).slice(-4)
  return `${prefix}_${time}${rand}`
}

// ── Factory helpers ────────────────────────────────────────────────
export function createContainer(
  direction: "row" | "column" = "column",
): TreeNode {
  return {
    id: newId("box"),
    kind: "container",
    label: direction === "row" ? "Column" : "Row",
    direction,
    children: [],
  }
}

export function createHtmlNode(html: string, label = "Component"): TreeNode {
  return {
    id: newId("cmp"),
    kind: "html",
    label,
    html,
  }
}

/** Collect every HTML component under a subtree (e.g. the page root). */
export function collectHtmlNodes(
  node: TreeNode,
  out: { id: string; label: string; html: string }[] = [],
): { id: string; label: string; html: string }[] {
  if (node.kind === "html") {
    out.push({ id: node.id, label: node.label, html: node.html ?? "" })
  }
  for (const child of node.children ?? []) {
    collectHtmlNodes(child, out)
  }
  return out
}

// ── Immutable tree operations ──────────────────────────────────────
export function findNode(node: TreeNode, id: string): TreeNode | null {
  if (node.id === id) return node
  if (!node.children) return null
  for (const child of node.children) {
    const found = findNode(child, id)
    if (found) return found
  }
  return null
}

export function findParent(
  node: TreeNode,
  id: string,
  parent: TreeNode | null = null,
): TreeNode | null {
  if (node.id === id) return parent
  if (!node.children) return null
  for (const child of node.children) {
    const found = findParent(child, id, node)
    if (found !== null || child.id === id) {
      return child.id === id ? node : found
    }
  }
  return null
}

export function updateNode(
  node: TreeNode,
  id: string,
  updater: (n: TreeNode) => TreeNode,
): TreeNode {
  if (node.id === id) return updater(node)
  if (!node.children) return node
  return {
    ...node,
    children: node.children.map((c) => updateNode(c, id, updater)),
  }
}

export function insertChild(
  node: TreeNode,
  parentId: string,
  child: TreeNode,
  index?: number,
): TreeNode {
  if (node.id === parentId && node.kind === "container") {
    const children = [...(node.children ?? [])]
    if (index === undefined || index >= children.length) {
      children.push(child)
    } else {
      children.splice(Math.max(0, index), 0, child)
    }
    return { ...node, children }
  }
  if (!node.children) return node
  return {
    ...node,
    children: node.children.map((c) => insertChild(c, parentId, child, index)),
  }
}

export function removeNode(node: TreeNode, id: string): TreeNode {
  if (!node.children) return node
  return {
    ...node,
    children: node.children
      .filter((c) => c.id !== id)
      .map((c) => removeNode(c, id)),
  }
}

/** Insert a new child immediately after a sibling within the same parent. */
export function insertSiblingAfter(
  root: TreeNode,
  nodeId: string,
  child: TreeNode,
): TreeNode {
  const parent = findParent(root, nodeId)
  if (!parent?.children) return root
  const idx = parent.children.findIndex((c) => c.id === nodeId)
  if (idx === -1) return root
  return insertChild(root, parent.id, child, idx + 1)
}

/** Replace a node with a layout container that holds the original node. */
export function wrapNodeInContainer(
  root: TreeNode,
  nodeId: string,
  direction: "row" | "column",
): { root: TreeNode; wrapperId: string | null } {
  const node = findNode(root, nodeId)
  const parent = findParent(root, nodeId)
  if (!node || !parent?.children || nodeId === "root") {
    return { root, wrapperId: null }
  }

  const wrapper = createContainer(direction)
  wrapper.children = [node]

  const idx = parent.children.findIndex((c) => c.id === nodeId)
  if (idx === -1) return { root, wrapperId: null }

  const nextRoot = updateNode(root, parent.id, (p) => {
    if (!p.children) return p
    const children = [...p.children]
    children[idx] = wrapper
    return { ...p, children }
  })

  return { root: nextRoot, wrapperId: wrapper.id }
}

export function moveNodeUp(root: TreeNode, id: string): TreeNode {
  return reorderSibling(root, id, -1)
}

export function moveNodeDown(root: TreeNode, id: string): TreeNode {
  return reorderSibling(root, id, 1)
}

function reorderSibling(node: TreeNode, id: string, delta: number): TreeNode {
  if (node.children) {
    const idx = node.children.findIndex((c) => c.id === id)
    if (idx !== -1) {
      const target = idx + delta
      if (target < 0 || target >= node.children.length) return node
      const children = [...node.children]
      const [moved] = children.splice(idx, 1)
      children.splice(target, 0, moved)
      return { ...node, children }
    }
    return {
      ...node,
      children: node.children.map((c) => reorderSibling(c, id, delta)),
    }
  }
  return node
}

export function resizeAdjacentChildren(
  root: TreeNode,
  parentId: string,
  leftId: string,
  rightId: string,
  delta: number,
): TreeNode {
  return updateNode(root, parentId, (parent) => {
    if (parent.kind !== "container" || !parent.children) return parent
    const direction = parent.direction ?? "column"
    const children =
      direction === "row"
        ? resizeHorizontalSiblings(parent.children, leftId, rightId, delta)
        : resizeVerticalSiblings(parent.children, leftId, rightId, delta)
    return { ...parent, children }
  })
}

export function setChildLayoutSize(
  root: TreeNode,
  parentId: string,
  childId: string,
  value: number,
): TreeNode {
  return updateNode(root, parentId, (parent) => {
    if (parent.kind !== "container" || !parent.children) return parent
    const direction = parent.direction ?? "column"
    const children = setChildLayoutSizeInParent(
      parent.children,
      childId,
      value,
      direction,
    )
    return { ...parent, children }
  })
}

// ── Starter tree for a new site ────────────────────────────────────
export function starterTree(): SiteTree {
  const root: TreeNode = {
    id: "root",
    kind: "container",
    label: "Page",
    direction: "column",
    children: [
      createHtmlNode(
        `<header style="padding:48px 32px;text-align:center;background:#0f0d1a;color:#fff;font-family:sans-serif">
  <h1 style="font-size:40px;margin:0 0 12px;font-weight:700">Your headline here</h1>
  <p style="font-size:18px;opacity:.75;margin:0">Select this component and chat to rewrite it with your own LLM.</p>
</header>`,
        "Hero",
      ),
      createHtmlNode(
        `<section style="padding:40px 32px;font-family:sans-serif;color:#1a1a1a">
  <p style="max-width:640px;margin:0 auto;text-align:center;line-height:1.6">
    This is an editable component. Every block on the page has its own unique ID.
    Click it, then describe the change you want in the chat panel.
  </p>
</section>`,
        "Intro",
      ),
    ],
  }
  return { root }
}
