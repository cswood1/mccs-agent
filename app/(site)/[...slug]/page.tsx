/* eslint-disable @next/next/no-html-link-for-pages -- plain links, like the real site */
import type { Metadata } from "next";
import { allPagePaths, loadPage, SITE_ORIGIN } from "@/lib/site/data";
import { ArticleTemplate, DetailTemplate, ListingTemplate, NotCaptured, SectionTemplate, templateFor } from "@/app/(site)/templates";

// Every captured page of the installation site, generated from data/site/<id>/pages.
type Params = { slug: string[] };

export function generateStaticParams(): Params[] {
  return allPagePaths()
    .filter((p) => p !== "/")
    .map((p) => ({ slug: p.slice(1).split("/") }));
}

const pathOf = (slug: string[]) => "/" + slug.map(decodeURIComponent).join("/");

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const page = loadPage(pathOf((await params).slug));
  return { title: page?.title || "Page not captured" };
}

export default async function SitePage({ params }: { params: Promise<Params> }) {
  const path = pathOf((await params).slug);
  const page = loadPage(path);

  if (!page) {
    // A link to a page that wasn't captured (or doesn't exist): say so and point to the real one.
    return (
      <div className="container my-5" style={{ maxWidth: 720 }}>
        <h1 className="h2">Not part of the demo</h1>
        <NotCaptured url={SITE_ORIGIN + path} />
        <p>
          <a href="/">Back to the home page</a>
        </p>
      </div>
    );
  }

  if (path === "/stories") return <ListingTemplate path={path} page={page} kind="stories" />;
  if (path === "/calendar-of-events") return <ListingTemplate path={path} page={page} kind="events" />;

  const Template = { section: SectionTemplate, detail: DetailTemplate, article: ArticleTemplate }[templateFor(path, page)];
  return <Template path={path} page={page} />;
}
