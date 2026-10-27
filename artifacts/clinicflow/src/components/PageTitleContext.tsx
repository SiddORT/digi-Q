import { createContext, useContext, useEffect, useId, useState, type ReactNode, type MutableRefObject } from "react";

export interface ListPageTitle { title: ReactNode; eyebrow?: ReactNode; subtitle?: ReactNode; owner: MutableRefObject<string | null> }
export const ListPageTitleContext = createContext<ListPageTitle | null>(null);
/** The active route/tab delegates its one h1 to its first header. Hidden panels
 * receive a null context so eagerly mounted editors cannot claim a visible title. */
export function usePageTitleOwnership() {
  const ctx = useContext(ListPageTitleContext);
  const id = useId();
  const [, refresh] = useState(0);
  if (ctx && !ctx.owner.current) ctx.owner.current = id;
  const owns = !!ctx && ctx.owner.current === id;
  useEffect(() => () => { if (ctx && ctx.owner.current === id) ctx.owner.current = null; }, [ctx, id]);
  useEffect(() => {
    if (ctx && !ctx.owner.current) { ctx.owner.current = id; refresh(n => n + 1); }
  });
  return owns ? ctx : null;
}
