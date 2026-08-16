"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createSite, deleteSite, renameSite } from "@/app/actions/sites"
import { SITE_TEMPLATES, type SiteTemplateId } from "@/lib/templates"
import { authClient } from "@/lib/auth-client"
import { formatShortDate } from "@/lib/utils"
import { publicSiteHomeHref } from "@/lib/tree"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  LlmSettingsDialog,
  type LlmState,
} from "@/components/llm-settings-dialog"
import {
  McpSettingsDialog,
  type McpState,
} from "@/components/mcp-settings-dialog"
import {
  Plus,
  MoreVertical,
  Settings2,
  Plug,
  LogOut,
  Pencil,
  Trash2,
  ArrowUpRight,
} from "lucide-react"
import { toast } from "sonner"

interface SiteRow {
  id: string
  name: string
  slug: string | null
  updatedAt: string
  published: boolean
}

export function DashboardClient({
  userName,
  sites: initialSites,
  llm: initialLlm,
  mcp,
}: {
  userName: string
  sites: SiteRow[]
  llm: LlmState
  mcp: McpState
}) {
  const router = useRouter()
  const [sites, setSites] = useState(initialSites)
  const [llm, setLlm] = useState(initialLlm)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [selectedTemplate, setSelectedTemplate] =
    useState<SiteTemplateId>("default")
  const [createOpen, setCreateOpen] = useState(false)
  const [renaming, setRenaming] = useState<SiteRow | null>(null)
  const [renameValue, setRenameValue] = useState("")

  const handleCreate = async () => {
    setCreating(true)
    try {
      const id = await createSite(newName, selectedTemplate)
      router.push(`/builder/${id}`)
    } catch {
      toast.error("Could not create the site.")
      setCreating(false)
    }
  }

  const handleRename = async () => {
    if (!renaming) return
    const target = renaming
    setSites((prev) =>
      prev.map((s) => (s.id === target.id ? { ...s, name: renameValue } : s)),
    )
    setRenaming(null)
    try {
      await renameSite(target.id, renameValue)
    } catch {
      toast.error("Rename failed.")
    }
  }

  const handleDelete = async (id: string) => {
    const prev = sites
    setSites((s) => s.filter((x) => x.id !== id))
    try {
      await deleteSite(id)
      toast.success("Site deleted.")
    } catch {
      setSites(prev)
      toast.error("Delete failed.")
    }
  }

  const signOut = async () => {
    await authClient.signOut()
    router.push("/sign-in")
    router.refresh()
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/80 px-6 py-4 backdrop-blur md:px-10">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-medium tracking-widest text-foreground">
            LATCH<span className="text-primary">/</span>
          </span>
          <Badge
            variant={llm.hasKey ? "secondary" : "outline"}
            className="font-mono text-[10px]"
          >
            {llm.hasKey ? `model: ${llm.model}` : "no LLM configured"}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <McpSettingsDialog
            mcp={mcp}
            trigger={
              <Button variant="ghost" size="sm">
                <Plug className="mr-1.5 h-4 w-4" />
                MCP
              </Button>
            }
          />
          <LlmSettingsDialog
            llm={llm}
            onSaved={setLlm}
            trigger={
              <Button variant="ghost" size="sm">
                <Settings2 className="mr-1.5 h-4 w-4" />
                LLM
              </Button>
            }
          />
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-1.5 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Workspace · {userName}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              Your sites
            </h1>
          </div>
          <Button
            onClick={() => {
              setNewName("")
              setSelectedTemplate("default")
              setCreateOpen(true)
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New site
          </Button>
        </div>

        {!llm.hasKey && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              Configure your LLM endpoint to enable chat editing inside the
              builder.
            </p>
            <LlmSettingsDialog
              llm={llm}
              onSaved={setLlm}
              trigger={
                <Button size="sm" variant="outline">
                  Configure now
                </Button>
              }
            />
          </div>
        )}

        {sites.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground">
              No sites yet. Create your first one to start building.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sites.map((s) => (
              <li
                key={s.id}
                className="group relative flex flex-col rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/50"
              >
                <div className="mb-6 flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {s.id}
                    </span>
                    {s.published && (
                      <Badge variant="secondary" className="text-[10px]">
                        Live
                      </Badge>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <button
                          className="rounded p-1 text-muted-foreground opacity-0 transition hover:bg-secondary hover:text-foreground group-hover:opacity-100"
                          aria-label={`Actions for ${s.name}`}
                        />
                      }
                    >
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setRenaming(s)
                          setRenameValue(s.name)
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDelete(s.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Link href={`/builder/${s.id}`} className="mt-auto block">
                  <h3 className="flex items-center gap-1 text-lg font-semibold text-card-foreground">
                    {s.name}
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Edited {formatShortDate(s.updatedAt)}
                  </p>
                </Link>
                {s.published && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    <a
                      href={publicSiteHomeHref({ id: s.id, slug: s.slug })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {publicSiteHomeHref({ id: s.id, slug: s.slug })}
                    </a>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create a new site</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              autoFocus
              placeholder="My landing page"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing)
                  handleCreate()
              }}
            />
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Template
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {SITE_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setSelectedTemplate(template.id)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      selectedTemplate === template.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <p className="text-sm font-medium">{template.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {template.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={creating} className="w-full">
              {creating ? "Creating..." : "Create & open"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog
        open={Boolean(renaming)}
        onOpenChange={(o) => !o && setRenaming(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename site</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) handleRename()
            }}
          />
          <DialogFooter>
            <Button onClick={handleRename} className="w-full">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
