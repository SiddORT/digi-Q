import type { ReactNode } from "react";
import "./clinic-listing-toolbar.css";
import { usePageTitleOwnership } from "./PageTitleContext";

/** Non-list surfaces share the header geometry without artificial list controls. */
export function PageHeader({ title, description, eyebrow, actions, level = 1, id }: {
  title: ReactNode; description?: ReactNode; eyebrow?: ReactNode;
  actions?: ReactNode; level?: 1 | 2 | 3; id?: string;
}) {
  const pageTitle = usePageTitleOwnership();
  const Heading = `h${pageTitle ? 1 : level}` as "h1" | "h2" | "h3";
  return <header className="page-heading standard-page-header">
    <div>{(eyebrow || pageTitle?.eyebrow) && <span className="eyebrow">{eyebrow || pageTitle?.eyebrow}</span>}<Heading id={id}>{title}</Heading>{description}</div>
    {actions && <div className="standard-header-actions">{actions}</div>}
  </header>;
}
