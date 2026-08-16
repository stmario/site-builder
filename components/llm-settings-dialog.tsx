"use client"

import { isValidElement, useState } from "react"
import { saveLlmConfig } from "@/app/actions/llm"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export interface LlmState {
  baseUrl: string
  model: string
  hasKey: boolean
}

export function LlmSettingsDialog({
  llm,
  trigger,
  onSaved,
}: {
  llm: LlmState
  trigger: React.ReactNode
  onSaved?: (next: LlmState) => void
}) {
  const [open, setOpen] = useState(false)
  const [baseUrl, setBaseUrl] = useState(llm.baseUrl)
  const [model, setModel] = useState(llm.model)
  const [apiKey, setApiKey] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!baseUrl.trim()) {
      toast.error("Base URL is required.")
      return
    }
    if (!llm.hasKey && !apiKey.trim()) {
      toast.error("An API key is required the first time.")
      return
    }
    setSaving(true)
    try {
      await saveLlmConfig({ baseUrl, model, apiKey: apiKey || undefined })
      const next: LlmState = {
        baseUrl: baseUrl.trim().replace(/\/+$/, ""),
        model: model.trim() || "gpt-4o-mini",
        hasKey: llm.hasKey || Boolean(apiKey.trim()),
      }
      toast.success("LLM settings saved.")
      setApiKey("")
      setOpen(false)
      onSaved?.(next)
    } catch {
      toast.error("Could not save settings.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isValidElement(trigger) ? (
        <DialogTrigger render={trigger} />
      ) : (
        <DialogTrigger>{trigger}</DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>LLM endpoint</DialogTitle>
          <DialogDescription>
            Provide any OpenAI-compatible chat completions API. Your key is
            stored securely and never leaves the server.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="baseUrl">Base URL</Label>
            <Input
              id="baseUrl"
              placeholder="https://api.openai.com/v1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              We call{" "}
              <span className="font-mono">{"{base}/chat/completions"}</span>.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="model">Model</Label>
            <Input
              id="model"
              placeholder="gpt-4o-mini"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="apiKey">
              API key{" "}
              {llm.hasKey && (
                <span className="font-normal text-muted-foreground">
                  (saved — leave blank to keep)
                </span>
              )}
            </Label>
            <Input
              id="apiKey"
              type="password"
              placeholder={llm.hasKey ? "••••••••••••" : "sk-..."}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Saving..." : "Save settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
