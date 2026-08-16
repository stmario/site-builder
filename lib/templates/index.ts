import { starterDocument, type SiteDocument } from "@/lib/tree"
import { blogStarterDocument } from "./blog-starter"

export type SiteTemplateId = "default" | "blog"

export const SITE_TEMPLATES = [
  {
    id: "default" as const,
    name: "Blank landing",
    description: "Hero section and intro text",
    create: starterDocument,
  },
  {
    id: "blog" as const,
    name: "Blog",
    description: "Blog layout with header, post, and footer",
    create: blogStarterDocument,
  },
] satisfies {
  id: SiteTemplateId
  name: string
  description: string
  create: () => SiteDocument
}[]

export function createDocumentFromTemplate(id: SiteTemplateId): SiteDocument {
  return SITE_TEMPLATES.find((t) => t.id === id)?.create() ?? starterDocument()
}
