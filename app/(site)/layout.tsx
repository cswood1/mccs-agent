import Script from "next/script";
import { fragment } from "@/lib/site/data";
import { Raw } from "@/app/(site)/raw";
import SiteEnhancements from "@/app/(site)/site-enhancements";

// Chrome shared by every page of the recreated site: demo banner, the captured header
// and footer, Bootstrap's JS, and the assistant widget.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="demo-banner" role="note">
        Prototype demo — not the official MCCS site.{" "}
        <a href="https://quantico.usmc-mccs.org/" rel="noopener">
          Go to the real site
        </a>
      </div>
      <div className="dialog-off-canvas-main-canvas">
        <div id="page-wrapper">
          <div id="page">
            <Raw html={fragment("header")} />
            <Raw html={fragment("search-modal")} />
            <div id="main-wrapper" className="layout-main-wrapper clearfix">
              {children}
            </div>
            <Raw html={fragment("footer")} />
          </div>
        </div>
      </div>
      <Script src="/theme/vendor/bootstrap.bundle.min.js" strategy="afterInteractive" />
      <SiteEnhancements />
      <Script
        src="/widget.js"
        data-installation="quantico"
        data-site-host="quantico.usmc-mccs.org"
        strategy="afterInteractive"
      />
    </>
  );
}
