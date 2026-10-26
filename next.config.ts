import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Content and theme files are read from disk; ship them with the server routes.
  outputFileTracingIncludes: {
    "/*": ["./data/**/*", "./site/**/*"],
    "/**/*": ["./data/**/*", "./site/**/*"],
  },
  // Same redirects the real site sends (recorded during the WebFetch crawl).
  async redirects() {
    return [
      { source: "/quantico/careers", destination: "https://careers.usmc-mccs.org/", permanent: false },
      { source: "/quantico/services/post-offices", destination: "https://www.quantico.marines.mil/Offices-Staff/Military-Post-Office/", permanent: false },
      { source: "/quantico/marine-family-support/military-family-life/voting-assistance", destination: "https://www.quantico.marines.mil/Resources/Voter-Assistance/", permanent: false },
      { source: "/quantico/marine-family-support/voting-assistance", destination: "https://www.quantico.marines.mil/Resources/Voter-Assistance/", permanent: false },
      { source: "/quantico/about/local-area-information", destination: "https://www.quantico.marines.mil/Resources/Weather/", permanent: false },
      // These two serve their parent/sibling page on the real site.
      { source: "/quantico/recreation-fitness/sports/youth-sports", destination: "/quantico/recreation-fitness/recreation/sports/youth-sports", permanent: false },
      { source: "/quantico/marine-family-support/child-and-youth/k-12-school-liaison-program", destination: "/quantico/marine-family-support/child-and-youth", permanent: false },
    ];
  },
  // Prototype demo of a real site: keep it out of search engines.
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }] }];
  },
};

export default nextConfig;
