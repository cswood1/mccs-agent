// Lets Node load the app's TypeScript modules directly in unit checks: resolves "@/..." imports
// to the project root (adding .ts when there's no extension). Node strips the types itself.
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
    return next(specifier, context);
  },
});
