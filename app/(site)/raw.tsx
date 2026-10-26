/** Static markup from the captured theme. display:contents keeps the original DOM shape for CSS. */
export function Raw({ html }: { html: string }) {
  return <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: html }} />;
}
