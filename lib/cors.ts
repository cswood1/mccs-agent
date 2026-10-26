// The widget is embedded on other origins (the real MCCS sites), so the API must
// allow cross-origin calls. Prototype: allow any origin. Before a real deployment,
// restrict this to each installation's site URL.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Demo-Access",
  // Lets a public page (e.g. via the bookmarklet) call a localhost dev server in Chrome.
  "Access-Control-Allow-Private-Network": "true",
};

export function preflight() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
