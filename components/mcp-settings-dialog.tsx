"use client"

import { isValidElement, useState } from "react"
import { revealMcpApiKey, rotateMcpApiKey } from "@/app/actions/mcp"
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

export interface McpState {
  endpointUrl: string
}

export function McpSettingsDialog({
  mcp,
  trigger,
}: {
  mcp: McpState
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [endpointUrl, setEndpointUrl] = useState(mcp.endpointUrl)
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [rotating, setRotating] = useState(false)

  const handleReveal = async () => {
    setLoading(true)
    try {
      const result = await revealMcpApiKey()
      setApiKey(result.apiKey)
      setEndpointUrl(result.endpointUrl)
    } catch {
      toast.error("Could not load MCP API key.")
    } finally {
      setLoading(false)
    }
  }

  const handleRotate = async () => {
    setRotating(true)
    try {
      const result = await rotateMcpApiKey()
      setApiKey(result.apiKey)
      setEndpointUrl(result.endpointUrl)
      toast.success("MCP API key rotated. Update your MCP client config.")
    } catch {
      toast.error("Could not rotate MCP API key.")
    } finally {
      setRotating(false)
    }
  }

  const copyConfig = async () => {
    if (!apiKey) {
      toast.error("Reveal your API key first.")
      return
    }
    const config = {
      mcpServers: {
        latch: {
          url: endpointUrl,
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
      },
    }
    await navigator.clipboard.writeText(JSON.stringify(config, null, 2))
    toast.success("Cursor MCP config copied to clipboard.")
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setApiKey(null)
          setEndpointUrl(mcp.endpointUrl)
        }
      }}
    >
      {isValidElement(trigger) ? (
        <DialogTrigger render={trigger} />
      ) : (
        <DialogTrigger>{trigger}</DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>MCP editing</DialogTitle>
          <DialogDescription>
            Connect Cursor or another MCP client to list, edit, and publish your
            sites programmatically.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="mcpEndpoint">MCP endpoint</Label>
            <Input
              id="mcpEndpoint"
              readOnly
              value={endpointUrl}
              className="font-mono text-sm"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="mcpApiKey">API key</Label>
            <Input
              id="mcpApiKey"
              readOnly
              type={apiKey ? "text" : "password"}
              placeholder="Click reveal to show your key"
              value={apiKey ?? "••••••••••••••••••••••••"}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Send as{" "}
              <span className="font-mono">Authorization: Bearer &lt;key&gt;</span>{" "}
              or{" "}
              <span className="font-mono">x-api-key: &lt;key&gt;</span>.
            </p>
          </div>

          <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Available tools</p>
            <p>
              list_sites, get_site, list_components, get_component,
              update_component_html, edit_component_with_llm, save_site_document,
              publish_site, create_site
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <div className="flex w-full gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleReveal}
              disabled={loading}
            >
              {loading ? "Loading..." : apiKey ? "Refresh key" : "Reveal key"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleRotate}
              disabled={rotating}
            >
              {rotating ? "Rotating..." : "Rotate key"}
            </Button>
          </div>
          <Button
            type="button"
            className="w-full"
            onClick={copyConfig}
            disabled={!apiKey}
          >
            Copy Cursor config
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
