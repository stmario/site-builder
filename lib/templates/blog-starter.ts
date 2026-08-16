import {
  createHtmlNode,
  newId,
  type SiteDocument,
  type SiteTree,
} from "@/lib/tree"

function blogTree(): SiteTree {
  const root = {
    id: "root",
    kind: "container" as const,
    label: "Page",
    direction: "column" as const,
    children: [
      createHtmlNode(
        `<header style="background:#fff;border-bottom:1px solid #e2e4e7;padding:0 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:960px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;min-height:64px">
    <a href="#" style="font-size:22px;font-weight:700;color:#1d2327;text-decoration:none">My Site</a>
    <nav style="display:flex;gap:24px">
      <a href="#" style="color:#50575e;text-decoration:none;font-size:14px">Home</a>
      <a href="#" style="color:#50575e;text-decoration:none;font-size:14px">Blog</a>
      <a href="#" style="color:#50575e;text-decoration:none;font-size:14px">About</a>
    </nav>
  </div>
</header>`,
        "Header",
      ),
      createHtmlNode(
        `<main style="max-width:960px;margin:0 auto;padding:48px 24px;font-family:Georgia,'Times New Roman',serif;color:#1d2327">
  <article>
    <h1 style="font-size:36px;font-weight:400;margin:0 0 8px;line-height:1.2">Hello world!</h1>
    <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#787c82;margin:0 0 24px">
      Published on August 14, 2026
    </p>
    <div style="font-size:17px;line-height:1.7;color:#2c3338">
      <p style="margin:0 0 16px">Welcome to Site-Builder. This is your first post. Edit or delete it, then start writing!</p>
      <p style="margin:0">Select any block and use the chat panel to rewrite it with your LLM.</p>
    </div>
  </article>
</main>`,
        "Content",
      ),
      createHtmlNode(
        `<footer style="background:#1d2327;color:#a7aaad;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;text-align:center">
  <p style="margin:0">© 2026 My Site · Powered by Site-Builder</p>
</footer>`,
        "Footer",
      ),
    ],
  }
  return { root }
}

export function blogStarterDocument(): SiteDocument {
  return {
    pages: [
      {
        id: newId("page"),
        name: "Home",
        slug: "home",
        tree: blogTree(),
      },
    ],
  }
}
