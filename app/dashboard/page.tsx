import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { listSites } from "@/app/actions/sites"
import { getLlmConfig } from "@/app/actions/llm"
import { getMcpConfig } from "@/app/actions/mcp"
import { DashboardClient } from "@/components/dashboard-client"

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const [sites, llm, mcp] = await Promise.all([
    listSites(),
    getLlmConfig(),
    getMcpConfig(),
  ])

  return (
    <DashboardClient
      userName={session.user.name}
      sites={sites.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        updatedAt: s.updatedAt.toISOString(),
        published: s.published,
      }))}
      llm={llm}
      mcp={{ endpointUrl: mcp.endpointUrl }}
    />
  )
}
