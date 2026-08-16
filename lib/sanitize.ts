import DOMPurify from "isomorphic-dompurify"

// The LLM returns raw HTML that we render into the canvas. Sanitize it to
// remove scripts, event handlers, and other injection vectors while keeping
// styling (inline styles + scoped <style> blocks) intact.
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ADD_TAGS: ["style"],
    ADD_ATTR: ["target"],
    FORBID_TAGS: ["script", "iframe", "object", "embed", "link", "meta"],
    FORBID_ATTR: ["onerror", "onload", "onclick"],
    // Keep style attributes and CSS.
    ALLOW_UNKNOWN_PROTOCOLS: false,
  })
}
