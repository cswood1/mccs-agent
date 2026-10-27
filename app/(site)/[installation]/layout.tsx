import type { Metadata } from "next";
import Script from "next/script";
import { notFound } from "next/navigation";
import { fragment, SITE_INSTALLATIONS, siteInstallation } from "@/lib/site/data";
import { getInstallation } from "@/lib/installations";
import { Raw } from "@/app/(site)/raw";
import SiteEnhancements from "@/app/(site)/site-enhancements";

// Every installation in the real location picker gets /<slug>/... (docs/PRODUCT.md §12).
export function generateStaticParams() {
  return SITE_INSTALLATIONS.map((i) => ({ installation: i.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ installation: string }> }): Promise<Metadata> {
  const site = siteInstallation((await params).installation);
  // The root layout's template wraps the default: "MCCS <name> (prototype demo)".
  return { title: { default: site?.name ?? "", template: `MCCS %s (prototype demo)` } };
}

// Chrome shared by every page of the recreated sites: demo banner, the captured header and
// footer (links and the location picker adjusted for this installation), Bootstrap's JS, and
// the assistant widget for installations that have an assistant config.
export default async function InstallationLayout({ children, params }: LayoutProps<"/[installation]">) {
  const { installation } = await params;
  const site = siteInstallation(installation);
  if (!site) notFound();
  const assistant = getInstallation(installation);

  return (
    <>
      <div className="demo-banner" role="note">
        <span className="demo-banner-full">NPS SI Hackathon - MCCS Agent - Team 2 - Prototype Demo</span>
        <span className="demo-banner-short">NPS SI Hackathon · Team 2 · Prototype Demo</span>
      </div>
      <div className="dialog-off-canvas-main-canvas">
        <div id="page-wrapper">
          <div id="page">
            <Raw html={fragment(installation, "header")} />
            <Raw html={fragment(installation, "search-modal")} />
            <div id="main-wrapper" className="layout-main-wrapper clearfix">
              {children}
            </div>
            <Raw html={fragment(installation, "footer")} />
          </div>
        </div>
      </div>
      <Script src="/theme/vendor/bootstrap.bundle.min.js" strategy="afterInteractive" />
      <SiteEnhancements />
      {assistant && (
        <Script
          src="/widget.js"
          data-installation={installation}
          data-demo-host="1"
          data-path-prefix={`/${installation}`}
          strategy="afterInteractive"
        />
      )}
    </>
  );
}
