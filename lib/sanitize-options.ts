import sanitizeHtmlLib from "sanitize-html"

export const sanitizeHtmlOptions: sanitizeHtmlLib.IOptions = {
  allowedTags: [
    ...sanitizeHtmlLib.defaults.allowedTags,
    "style",
    "img",
    "figure",
    "figcaption",
  ],
  allowedAttributes: {
    ...sanitizeHtmlLib.defaults.allowedAttributes,
    "*": [...(sanitizeHtmlLib.defaults.allowedAttributes["*"] ?? []), "style"],
    a: ["href", "name", "target", "rel"],
    img: ["src", "srcset", "alt", "title", "width", "height", "loading", "style"],
  },
  disallowedTagsMode: "discard",
}
