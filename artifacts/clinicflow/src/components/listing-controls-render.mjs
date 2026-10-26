// Render the real shared header, including its children, without matching JSX
// spelling. Interactive geometry/drawer behavior belongs to the browser check.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadModule } from "../test/load-module.mjs";
const controls = await loadModule(new URL("./ListingControls.tsx", import.meta.url));

export function renderFilterBar(props = {}, pageTitle = false) {
  const header = createElement(controls.FilterBar, props);
  return renderToStaticMarkup(pageTitle
    ? createElement(controls.ListPageTitleContext.Provider, {
      value: { title: "Appointments", owner: { current: null } },
    }, header)
    : header);
}
