/* eslint-disable @next/next/no-html-link-for-pages -- plain links give full page loads, like the real site */
import { localHref, pagesUnder, SITE_ORIGIN, type SitePage } from "@/lib/site/data";
import { renderMarkdown, renderInline } from "@/lib/site/markdown";
import { isWithin, sectionFor, type NavItem } from "@/lib/site/nav";
import Photo from "@/app/(site)/photo";

// Page templates recreated from the captured theme (design/reference). Class names and
// structure follow the real markup so the site's own CSS styles them.

type Props = { path: string; page: SitePage };

export type TemplateName = "section" | "detail" | "article";

export function templateFor(path: string, page: SitePage): TemplateName {
  if (/^\/(news|activity)\//.test(path)) return "article";
  const section = sectionFor(path);
  if (section?.href === path && page.contacts.length === 0) return "section";
  return "detail";
}

// ---------- shared pieces ----------

function Main({ children }: { children: React.ReactNode }) {
  return (
    <div id="main" className="container-fluid p-0">
      <div className="row-offcanvas row-offcanvas-left clearfix">
        <main id="content" className="main-content order-last">
          <section className="section">
            <a id="main-content" tabIndex={-1} />
            <div id="block-mccs-content" className="block block-system block-system-main-block">
              <div className="content">{children}</div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

/** Section headings get ids so "On this page" can link to them. */
function sectionsWithIds(page: SitePage) {
  const seen = new Map<string, number>();
  return page.sections
    .filter((s) => s.markdown.trim() || (s.heading && !/^on this page:?$/i.test(s.heading.trim())))
    .filter((s) => !(s.heading.trim() === "Contact Information and Resources" && !s.markdown.trim()))
    .filter((s) => !/^on this page:?$/i.test(s.heading.trim()))
    .map((s) => {
      const base = s.heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      return { ...s, id: n ? `${base}-${n}` : base };
    });
}

function Toc({ items }: { items: { id: string; heading: string }[] }) {
  const named = items.filter((i) => i.heading.trim());
  if (named.length < 2) return null;
  return (
    <div className="container toc-container my-4" id="toc-container">
      <div className="toc-header-desktop">
        <h5>On this page:</h5>
      </div>
      <div id="navigation" className="nav flex-column">
        {named.map((i) => (
          <a key={i.id} className="nav-link" href={`#${i.id}`}>
            {i.heading}
          </a>
        ))}
      </div>
    </div>
  );
}

function Body({ page }: { page: SitePage }) {
  const sections = sectionsWithIds(page);
  return (
    <>
      <Toc items={sections} />
      <div className="container">
        {page.intro && <p className="lead">{page.intro}</p>}
        {sections.map((s) => (
          <div key={s.id} id={s.id} className="mb-3">
            {s.heading.trim() && (
              <p>
                <strong>{s.heading}</strong>
              </p>
            )}
            {s.markdown.trim() && <div dangerouslySetInnerHTML={{ __html: renderMarkdown(s.markdown) }} />}
          </div>
        ))}
        {page.notCaptured && /failed|no real main content|only navigation/i.test(page.notCaptured) && (
          <NotCaptured url={page.url} />
        )}
      </div>
    </>
  );
}

export function NotCaptured({ url }: { url: string }) {
  return (
    <p className="capture-note border rounded p-3 bg-light">
      This page&apos;s content wasn&apos;t captured for the demo.{" "}
      <a href={url || SITE_ORIGIN} target="_blank" rel="noopener" className="external-link">
        View it on the real MCCS site
      </a>
      .
    </p>
  );
}

function HeaderCard({ title }: { title: string }) {
  // The real header photo isn't in the capture; the site's navy stands in.
  return (
    <div className="page-header-card" style={{ minHeight: 177, background: "linear-gradient(135deg, #0C2340 0%, #1A51A4 100%)" }}>
      <div className="card-content">
        <div className="header-title">
          <h1>{title}</h1>
        </div>
      </div>
    </div>
  );
}

const isStory = (url: string) => /\/(news|activity)\//.test(url);

/** Teaser cards that link to pages (not stories), in the site's "cards-grid" style. */
function CardsGrid({ cards }: { cards: SitePage["cards"] }) {
  const pages = cards.filter((c) => c.url && !isStory(c.url));
  if (!pages.length) return null;
  return (
    <div className="view-content row g-0">
      {pages.map((c) => {
        const href = localHref(c.url);
        return (
          <div key={c.url + c.title} className="col-12 col-sm-12 col-md-4 col-xl-3 d-md-flex" style={{ padding: "0px 3px 10px 3px" }}>
            <div className="cards-grid">
              <div className="cards-grid-image">
                <a href={href} aria-hidden="true" tabIndex={-1}>
                  <Photo src={c.image} alt="" />
                </a>
              </div>
              <h4 className="cards-grid-title">
                <a style={{ color: "black" }} href={href}>
                  {c.title}
                </a>
              </h4>
              {c.text && (
                <div className="cards-grid-summary">
                  <p className="roll-up-description-no-children" dangerouslySetInnerHTML={{ __html: renderInline(c.text) }} />
                </div>
              )}
              <a href={href}>
                <div className="btn btn-primary btn-cards-grid-read-more" style={{ width: "95%" }}>
                  <span>Read More</span>
                </div>
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RelatedStories({ cards, title = "Related Stories" }: { cards: SitePage["cards"]; title?: string }) {
  const stories = cards.filter((c) => isStory(c.url)).slice(0, 5);
  if (!stories.length) return null;
  return (
    <>
      <br />
      <div className="mb-3">
        <div className="card-body">
          <h5 className="card-title">{title}</h5>
          <div className="stories-recent view view-eva view-stories view-id-stories">
            <div>
              {stories.map((s) => (
                <div key={s.url} className="card mb-2 border-0 bg-light">
                  <div className="row g-0">
                    <div className="col-4">
                      <Photo src={s.image} className="h-100 w-100 rounded" alt="" style={{ objectFit: "cover" }} />
                    </div>
                    <div className="col-8">
                      <div className="card-body">
                        <p className="card-title">
                          <a className="stretched-link" href={localHref(s.url)}>
                            {s.title}
                          </a>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="more-link col-auto">
          <a className="btn btn-primary" href="/stories">
            Read More Stories
          </a>
        </div>
      </div>
    </>
  );
}

function SideNav({ path }: Props) {
  const section = sectionFor(path);
  if (!section) return null;
  return (
    <nav className="sidenav-container desktop border-0 rounded d-none d-md-block" aria-label="Side navigation">
      <div className="sidenav rounded">
        <ul style={{ marginBottom: 0 }} aria-label="Primary menu">
          <li>
            <a className="side-nav-title" href={section.href}>
              <strong>{section.label}</strong>
            </a>
          </li>
          {section.children.map((item, i) => (
            <SideNavItem key={item.href + i} item={item} path={path} index={i} />
          ))}
        </ul>
      </div>
    </nav>
  );
}

function SideNavItem({ item, path, index }: { item: NavItem; path: string; index: number }) {
  const active = isWithin(path, item.href);
  if (!item.children.length) {
    return (
      <li>
        <a href={item.href} className={`dropdown-btn ${path === item.href ? "active" : ""}`}>
          {item.label}
        </a>
      </li>
    );
  }
  const id = `sidenav-lvl2-${index}`;
  return (
    <li>
      <div className="sidenav-btn-group sidenav-btn-group-lvl1">
        <a className={`dropdown-main-button-a btn sidenav-main-button ${path === item.href ? "active" : ""}`} href={item.href}>
          {item.label}
        </a>
        <button
          type="button"
          className="border-0 btn sidenav-dropdown-arrow sidenav-dropdown-arrow-lvl1 dropdown-toggle-split"
          aria-controls={id}
          aria-expanded={active}
          aria-label={`Show ${item.label} pages`}
        >
          <i className="bi bi-chevron-down" />
        </button>
      </div>
      <ul id={id} className="sidenavUL dropdown-container dropdown-container-lvl2" style={{ display: active ? "block" : "none" }}>
        {item.children.map((c) => (
          <li key={c.href}>
            <a href={c.href} className={`dropdown-btn ${isWithin(path, c.href) ? "active" : ""}`}>
              {c.label}
            </a>
          </li>
        ))}
      </ul>
    </li>
  );
}

function ContactCard({ page }: { page: SitePage }) {
  if (!page.contacts.length) return null;
  return (
    <div className="card mb-2">
      <h5 className="m-3">Contact Information and Resources</h5>
      {page.contacts.map((c, i) => (
        <div key={i} className={i ? "border-top" : ""}>
          <div className="card-body">
            {c.name && <h6>{c.name}</h6>}
            {c.address && (
              <div className="mb-3">
                <p className="mb-1">
                  <strong>Address:</strong>
                </p>
                <p style={{ marginBottom: 0 }}>
                  <a
                    className="external-link"
                    target="_blank"
                    rel="noopener"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address.replace(/\n/g, ", "))}`}
                  >
                    {c.address.split("\n").map((line, j) => (
                      <span key={j}>
                        {j > 0 && <br />}
                        {line}
                      </span>
                    ))}
                  </a>
                </p>
              </div>
            )}
            {c.phones.length > 0 && (
              <div className="mb-3">
                {c.phones.map((p, j) => (
                  <div key={j} className={j ? "contact-phone" : ""}>
                    <p>
                      <b>{!p.label || /^(main|phone)$/i.test(p.label) ? "Phone" : p.label}: </b>
                      <a className="phone-number" href={`tel:${p.number.replace(/[^\d+]/g, "")}`}>
                        {p.number}
                      </a>
                    </p>
                  </div>
                ))}
              </div>
            )}
            {c.emails.length > 0 && (
              <div className="mb-3">
                <p className="mb-1">
                  <strong>Email:</strong>
                </p>
                {c.emails.map((e) => (
                  <p key={e} className="mb-1">
                    <a href={`mailto:${e}`}>{e}</a>
                  </p>
                ))}
              </div>
            )}
          </div>
          {c.hours.length > 0 && (
            <div className="border-bottom">
              <div className="m-3 t-hrs-c">
                <p className="mb-1">
                  <strong>Hours of operation:</strong>
                </p>
                {c.hours.map((h, j) => (
                  <div key={j}>
                    {h.label && <p>{h.label}</p>}
                    <table className="table table-striped table-bordered table-sm">
                      <tbody>
                        {h.rows.map((r, k) => (
                          <tr key={k}>
                            <td>{r.days}</td>
                            <td>{r.time}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
                {c.notes.map((n, j) => (
                  <p key={j}>{n}</p>
                ))}
              </div>
            </div>
          )}
          {!c.hours.length && c.notes.length > 0 && (
            <div className="m-3">
              {c.notes.map((n, j) => (
                <p key={j}>{n}</p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------- templates ----------

/** Section landing (e.g. /recreation-fitness): side nav + title + child-page cards. */
export function SectionTemplate({ path, page }: Props) {
  return (
    <Main>
      <div className="col-sm-12 bs-region bs-region--top">
        <div className="row pt-2 g-0">
          <div className="col-lg-3 order-2 order-lg-1 px-2">
            <div className="col-auto">
              <SideNav path={path} page={page} />
              <RelatedStories cards={page.cards} title="Other Stories" />
            </div>
          </div>
          <div className="col-lg-9 order-1 order-lg-2 px-2">
            <div className="col-auto">
              <h1>{page.title}</h1>
              <hr />
              <Body page={page} />
              <CardsGrid cards={page.cards} />
            </div>
          </div>
        </div>
      </div>
    </Main>
  );
}

/** Program and facility pages (e.g. /recreation-fitness/fitness, /lodging/inns-of-the-corps). */
export function DetailTemplate({ path, page }: Props) {
  const hasContacts = page.contacts.length > 0;
  return (
    <Main>
      <div className="container-fluid mt-2">
        <div className="row g-3">
          <div className="col-lg-3 col-md-4 col-12 order-lg-1 order-md-1 order-2">
            <SideNav path={path} page={page} />
            <RelatedStories cards={page.cards} />
          </div>
          <div className="col-lg-9 col-md-8 col-12 order-lg-2 order-md-2 order-1">
            <div className="row g-3">
              <div className={`${hasContacts ? "col-lg-8" : "col-lg-12"} col-12 order-lg-1 order-1`}>
                <HeaderCard title={page.title} />
                <Body page={page} />
                <CardsGrid cards={page.cards} />
              </div>
              {hasContacts && (
                <div className="col-lg-4 col-12 order-lg-2 order-2">
                  <ContactCard page={page} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Main>
  );
}

/** Stories (/news/...) and events (/activity/...). Same frame, no side nav. */
export function ArticleTemplate({ page }: Props) {
  const hero = page.images.find((i) => i.src && !page.cards.some((c) => c.image === i.src));
  return (
    <Main>
      <div className="container mt-3">
        <div className="row g-4">
          <div className="col-lg-8 col-12">
            <HeaderCard title={page.title} />
            {hero && (
              <p className="mt-3">
                <Photo src={hero.src} alt={hero.alt} className="img-fluid rounded" />
              </p>
            )}
            <Body page={page} />
            <ContactCard page={page} />
          </div>
          <div className="col-lg-4 col-12">
            <RelatedStories cards={page.cards} title="Other Stories" />
          </div>
        </div>
      </div>
    </Main>
  );
}

/**
 * /stories and /calendar-of-events load their lists dynamically on the real site (not
 * captured), so these are built from every story / event page we did capture.
 */
export function ListingTemplate({ page, kind }: Props & { kind: "stories" | "events" }) {
  const items = pagesUnder(kind === "stories" ? "/news/" : "/activity/").map(({ path, page: p }) => {
    const when = p.contacts.flatMap((c) => c.hours.flatMap((h) => h.rows)).find((r) => /\d/.test(r.days + r.time));
    return {
      path,
      title: p.title,
      image: p.images[0]?.src ?? "",
      meta: kind === "events" && when ? `${when.days}${when.time ? ` · ${when.time}` : ""}` : "",
    };
  });
  items.sort((a, b) => a.title.localeCompare(b.title));
  const title = kind === "stories" ? "Stories" : page.title || "Calendar of Events";
  return (
    <Main>
      <div className="container-fluid mt-2">
        <HeaderCard title={title} />
        <p className="capture-note mt-3">
          {kind === "stories"
            ? `${items.length} stories captured for this demo.`
            : `${items.length} events captured for this demo. Dates come from each event page as of October 26, 2026.`}{" "}
          The real site&apos;s list loads dynamically, so this one is rebuilt from the captured pages.
        </p>
        <div className="view-content row g-0">
          {items.map((it) => (
            <div key={it.path} className="col-12 col-sm-6 col-md-4 col-xl-3 d-md-flex" style={{ padding: "0px 3px 10px 3px" }}>
              <div className="cards-grid">
                <div className="cards-grid-image">
                  <a href={it.path} aria-hidden="true" tabIndex={-1}>
                    <Photo src={it.image} alt="" />
                  </a>
                </div>
                <h4 className="cards-grid-title">
                  <a style={{ color: "black" }} href={it.path}>
                    {it.title}
                  </a>
                </h4>
                {it.meta && (
                  <div className="cards-grid-summary">
                    <p className="roll-up-description-no-children">{it.meta}</p>
                  </div>
                )}
                <a href={it.path}>
                  <div className="btn btn-primary btn-cards-grid-read-more" style={{ width: "95%" }}>
                    <span>Read More</span>
                  </div>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Main>
  );
}
