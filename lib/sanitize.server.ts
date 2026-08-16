import "server-only"
import sanitizeHtmlLib from "sanitize-html"
import { sanitizeHtmlOptions } from "@/lib/sanitize-options"

// Sanitize LLM/editor HTML on the server (MCP, API routes). Uses sanitize-html
// instead of jsdom-based DOMPurify so Vercel serverless bundles stay stable.
export function sanitizeHtml(dirty: string): string {
  return sanitizeHtmlLib(dirty, sanitizeHtmlOptions)
}
