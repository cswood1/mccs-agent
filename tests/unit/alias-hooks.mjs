// Lets Node load the app's TypeScript modules directly in unit checks: resolves "@/..." imports
// to the project root (adding .ts when there's no extension), resolves next/server, and loads JSON
// imports. Node strips the types itself.
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) {
      let file = root + specifier.slice(2);
      if (!/\.\w+$/.test(file)) file = existsSync(file + ".ts") ? file + ".ts" : file + ".tsx";
      return next(pathToFileURL(file).href, context);
    }
    // Next's subpath entry points are plain files without an exports map (the bundler adds ".js").
    if (specifier === "next/server") return next("next/server.js", context);
    return next(specifier, context);
  },
  // The app imports JSON config without import attributes (the bundler allows it); add them here.
  load(url, context, next) {
    if (url.endsWith(".json")) return next(url, { ...context, importAttributes: { ...context.importAttributes, type: "json" } });
    return next(url, context);
  },
});
