import { readFile } from "node:fs/promises";
import path from "node:path";
import { accessCode } from "@/lib/access";

// Bookmarklet that injects this server's widget onto the live installation site.
// Sits behind the access gate, so it can carry the access code for the widget's API calls.
export async function GET(request: Request) {
  const template = await readFile(path.join(process.cwd(), "site", "bookmarklet.html"), "utf8");
  const config = {
    widgetSrc: new URL("/widget.js", request.url).toString(),
    accessCode: accessCode() ?? "",
  };
  const html = template.replace("__CONFIG__", JSON.stringify(config).replace(/</g, "\\u003c"));
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
