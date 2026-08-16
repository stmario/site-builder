import sanitizeHtmlLib from "sanitize-html"
import { sanitizeHtmlOptions } from "@/lib/sanitize-options"

// Browser-safe sanitizer for rendered site HTML in client components.
// Uses sanitize-html (not DOMPurify) so SSR of client components works without window.
export function sanitizeHtml(dirty: string): string {
  return sanitizeHtmlLib(dirty, sanitizeHtmlOptions)
}
