import { createMcpHandler, withMcpAuth } from "mcp-handler"
import { registerSiteEditingTools } from "@/lib/mcp/server"
import { verifyMcpRequest } from "@/lib/mcp/auth"

const mcpHandler = createMcpHandler(
  (server) => {
    registerSiteEditingTools(server)
  },
  {
    serverInfo: {
      name: "latch",
      version: "1.0.0",
    },
    instructions: `Latch is a visual website builder. Sites are JSON documents with pages; each page has a tree of layout containers and HTML components.

Workflow:
1. list_sites — find site ids
2. list_components — find editable component ids (cmp_...)
3. get_component — read current HTML
4. update_component_html or edit_component_with_llm — make changes
5. publish_site — go live at /s/{slug}

Each HTML component is a self-contained block with inline styles. Internal links must use the href values from the site context.`,
  },
)

const handler = withMcpAuth(mcpHandler, verifyMcpRequest, { required: true })

export { handler as GET, handler as POST, handler as DELETE }
