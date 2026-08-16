import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect, notFound } from "next/navigation"
import { getSite, ensureSiteSlug } from "@/app/actions/sites"
import { getLlmConfig } from "@/app/actions/llm"
import { BuilderClient } from "@/components/builder-client"
import { normalizeSiteDocument, resolvePageParam } from "@/lib/tree"

export default async function BuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { id } = await params
  const { page: pageParam } = await searchParams
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const [site, llm] = await Promise.all([getSite(id), getLlmConfig()])
  if (!site) notFound()

  const slug = site.slug ?? (await ensureSiteSlug(site.id))
  const document = normalizeSiteDocument(site.tree)
  const initialPageId = resolvePageParam(document.pages, pageParam).id

  return (
    <BuilderClient
      siteId={site.id}
      siteSlug={slug}
      siteName={site.name}
      initialDocument={document}
      initialPageId={initialPageId}
      initialPublished={site.published}
      llm={llm}
    />
  )
}
