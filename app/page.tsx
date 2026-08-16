import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect("/dashboard")

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <span className="font-mono text-sm font-medium tracking-widest text-foreground">
          LATCH<span className="text-primary">/</span>
        </span>
        <nav className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Sign in
          </Link>
          <Link href="/sign-up" className={cn(buttonVariants({ size: "sm" }))}>
            Get started
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          bring-your-own-LLM website builder
        </span>
        <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-6xl">
          Build pages from a component tree you can edit by chatting.
        </h1>
        <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
          Every component gets a unique, addressable ID. Select any block,
          describe the change, and your own OpenAI-compatible model rewrites it
          in place. No lock-in on the model — you supply the endpoint.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/sign-up" className={cn(buttonVariants({ size: "lg" }))}>
            Start building
          </Link>
          <Link
            href="/sign-in"
            className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
          >
            I have an account
          </Link>
        </div>

        <div className="mt-16 grid w-full gap-4 text-left md:grid-cols-3">
          {[
            {
              tag: "unique IDs",
              title: "Addressable components",
              body: "Each node in the tree carries its own stable ID, so edits always target exactly one block.",
            },
            {
              tag: "your model",
              title: "Any OpenAI-compatible API",
              body: "Paste a base URL and key. Works with hosted providers, gateways, or a local model.",
            },
            {
              tag: "freeform",
              title: "Nested layout tree",
              body: "Compose rows and columns, nest components freely, and reorder without touching code.",
            },
          ].map((f) => (
            <div
              key={f.tag}
              className="rounded-lg border border-border bg-card p-5"
            >
              <p className="mb-3 font-mono text-xs uppercase tracking-widest text-primary">
                {f.tag}
              </p>
              <h3 className="text-base font-semibold text-card-foreground">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
