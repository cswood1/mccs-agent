import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "MCCS Quantico (prototype demo)", template: "MCCS %s (prototype demo)" },
  description: "Prototype demo recreation of the MCCS Quantico site for testing the installation assistant. Not the official site.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// The site's own stylesheets, in their original order, served unprocessed from /public/theme.
const stylesheets = [
  "/theme/vendor/bootstrap.min.css",
  "/theme/vendor/bootstrap-icons/bootstrap-icons.css",
  "/theme/css/tokens.css",
  "/theme/css/all3.css",
  "/theme/css/mccs-style.css",
  "/theme/css/inline-style-tags.css",
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Root layout, so this applies to every page. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@300;400;500;600;700&family=Ubuntu:wght@400;500;700&family=Black+Ops+One&display=swap"
        />
        {stylesheets.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
      </head>
      <body className="layout-no-sidebars path-frontpage">{children}</body>
    </html>
  );
}
