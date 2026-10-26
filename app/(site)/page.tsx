import { fragment, loadPage, localHref } from "@/lib/site/data";
import { Raw } from "@/app/(site)/raw";
import Photo from "@/app/(site)/photo";

// Home page. Slides, tile artwork and partner logos come from the captured theme
// (site/fragments); the story cards come from the WebFetch capture of the home page.
export default function Home() {
  const home = loadPage("/");
  const stories = (home?.cards ?? []).filter((c) => c.url.includes("/news/"));

  return (
    <div id="main" className="container-fluid p-0">
      <div className="row-offcanvas row-offcanvas-left clearfix">
        <main id="content" className="main-content order-last">
          <section className="section">
            <a id="main-content" tabIndex={-1} />
            <div id="block-mccs-content" className="block block-system block-system-main-block">
              <div className="content">
                <Raw html={fragment("home-carousel-desktop")} />
                <Raw html={fragment("home-carousel-mobile")} />
                <Raw html={fragment("home-tiles")} />

                <div className="pb-2 pt-2 m-0" style={{ backgroundColor: "#0C2340" }}>
                  <div>
                    <header className="container mb-2 text-center text-light">
                      <h3 className="text-uppercase">
                        <span style={{ color: "#A6192E" }}>Stay</span> Informed
                      </h3>
                      <div className="home-story-intro">View local events, stories, updates, and more.</div>
                    </header>
                    <div>
                      <div className="row border border-0 g-0">
                        {[stories.slice(0, 4), stories.slice(4, 8)].map((row, i) => (
                          <div key={i} className="row g-0 card-group border border-0 d-flex flex-column flex-md-row flex-wrap">
                            {row.map((s) => (
                              <div key={s.url} className="col-12 col-md-6 col-lg-3 d-flex">
                                <div className="card rounded-0 border border-0 text-bg-dark position-relative w-100">
                                  <Photo src={s.image} className="card-img rounded-0" alt={s.title} />
                                  <div className="gradient-overlay" />
                                  <div className="card-img-overlay d-flex flex-column justify-content-end">
                                    {s.text && <span className="story-badge">{s.text}</span>}
                                    <a className="stretched-link text-light" href={localHref(s.url)}>
                                      <h5 className="card-title">{s.title}</h5>
                                    </a>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="container" style={{ margin: "10px auto" }} />
                  </div>
                  {/* The real site nests links in buttons; kept as raw markup to match it exactly. */}
                  <Raw html={MORE_BUTTONS} />
                </div>

                <Raw html={fragment("home-important-links")} />
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

const MORE_BUTTONS = `<div class="text-center">
<button class="btn btn-primary" style="margin-right:10px;border-radius:5px;"><a href="/calendar-of-events" style="color: white;">View More Events</a></button>
<button class="btn btn-primary" style="border-radius:5px;"><a href="/stories" style="color: white;">Read More Stories</a></button>
</div>`;
