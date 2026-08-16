import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getPublishedSite } from "@/app/actions/sites"
import { PreviewTree } from "@/components/preview-tree"
import { normalizeSiteDocument, rewriteDocumentLinksForPublic } from "@/lib/tree"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ siteId: string; slug: string }>
}): Promise<Metadata> {
  const { siteId } = await params
  const site = await getPublishedSite(siteId)
  if (!site) return { title: "Not found" }
  return { title: site.name }
}

export default async function PublicSiteSlugPage({
  params,
}: {
  params: Promise<{ siteId: string; slug: string }>
}) {
  const { siteId, slug } = await params
  const site = await getPublishedSite(siteId)
  if (!site) notFound()

  const siteRef = { id: site.id, slug: site.slug }
  const document = rewriteDocumentLinksForPublic(
    siteRef,
    normalizeSiteDocument(site.publishedTree),
  )
  const page = document.pages.find((p) => p.slug === slug || p.id === slug)
  if (!page) notFound()

  return (
    <main className="min-h-svh bg-white">
      <PreviewTree root={page.tree.root} />
    </main>
  )
}
