import "server-only"
import sanitizeHtmlLib from "sanitize-html"

// Sanitize LLM/editor HTML on the server (MCP, API routes). Uses sanitize-html
// instead of jsdom-based DOMPurify so Vercel serverless bundles stay stable.
export function sanitizeHtml(dirty: string): string {
  return sanitizeHtmlLib(dirty, {
    allowedTags: [...sanitizeHtmlLib.defaults.allowedTags, "style", "img", "figure", "figcaption"],
    allowedAttributes: {
      ...sanitizeHtmlLib.defaults.allowedAttributes,
      "*": [...(sanitizeHtmlLib.defaults.allowedAttributes["*"] ?? []), "style"],
      a: ["href", "name", "target", "rel"],
      img: ["src", "srcset", "alt", "title", "width", "height", "loading", "style"],
    },
    disallowedTagsMode: "discard",
  })
}
