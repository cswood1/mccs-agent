import type { Metadata } from "next";
import { allPagePaths, hasSiteContent, installationHref, loadPage, siteOrigin } from "@/lib/site/data";
import {
  ArticleTemplate,
  ComingSoon,
  DetailTemplate,
  ListingTemplate,
  NotCaptured,
  SectionTemplate,
  templateFor,
} from "@/app/(site)/templates";

// Every captured page of an installation's site, generated from data/site/<installation>/pages.
type Params = { installation: string; slug: string[] };

export function generateStaticParams({ params }: { params: { installation: string } }): { slug: string[] }[] {
  const paths = allPagePaths(params.installation)
    .filter((p) => p !== "/")
    .map((p) => ({ slug: p.slice(1).split("/") }));
  // Cache Components needs at least one result; every path of an installation without content
  // renders the same "coming soon" page, so one placeholder stands in for them.
  return paths.length ? paths : [{ slug: ["coming-soon"] }];
}

const pathOf = (slug: string[]) => "/" + slug.map(decodeURIComponent).join("/");

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { installation, slug } = await params;
  const page = loadPage(installation, pathOf(slug));
  return { title: page?.title || (hasSiteContent(installation) ? "Page not captured" : "Coming soon") };
}

export default async function SitePage({ params }: { params: Promise<Params> }) {
  const { installation: inst, slug } = await params;
  if (!hasSiteContent(inst)) return <ComingSoon inst={inst} />;

  const path = pathOf(slug);
  const page = loadPage(inst, path);

  if (!page) {
    // A link to a page that wasn't captured (or doesn't exist): say so and point to the real one.
    return (
      <div className="container my-5" style={{ maxWidth: 720 }}>
        <h1 className="h2">Not part of the demo</h1>
        <NotCaptured url={siteOrigin(inst) + path} />
        <p>
          <a href={installationHref(inst, "/")}>Back to the home page</a>
        </p>
      </div>
    );
  }

  if (path === "/stories") return <ListingTemplate inst={inst} path={path} page={page} kind="stories" />;
  if (path === "/calendar-of-events") return <ListingTemplate inst={inst} path={path} page={page} kind="events" />;

  const Template = { section: SectionTemplate, detail: DetailTemplate, article: ArticleTemplate }[templateFor(inst, path, page)];
  return <Template inst={inst} path={path} page={page} />;
}
