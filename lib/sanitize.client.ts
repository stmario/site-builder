import DOMPurify from "dompurify"

// Browser-only sanitizer for rendered site HTML in client components.
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ADD_TAGS: ["style"],
    ADD_ATTR: ["target"],
    FORBID_TAGS: ["script", "iframe", "object", "embed", "link", "meta"],
    FORBID_ATTR: ["onerror", "onload", "onclick"],
    ALLOW_UNKNOWN_PROTOCOLS: false,
  })
}
