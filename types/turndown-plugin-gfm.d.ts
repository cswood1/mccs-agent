declare module "turndown-plugin-gfm" {
  import type TurndownService from "turndown";
  const plugin: { gfm: TurndownService.Plugin; tables: TurndownService.Plugin };
  export default plugin;
}
