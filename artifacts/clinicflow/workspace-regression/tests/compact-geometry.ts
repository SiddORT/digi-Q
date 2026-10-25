import { expect, type Page } from "@playwright/test";

/** Reusable child containment assertion. Deliberately excludes horizontal
 * scrollers (tables/tablists/listboxes); those require their own text checks. */
export async function expectFormBounds(page:Page, scope=".content") {
  await expect.poll(()=>page.locator(scope).first().evaluate(root=>{
    const bad:string[]=[];
    for(const el of root.querySelectorAll<HTMLElement>("input:not([type=hidden]),textarea,select,.phone-input,.form-field-error,.form-field-help")){
      // Closed <details> descendants can retain client rects in Chromium.
      // They are not visible controls; expanded filters are checked separately.
      if(!el.checkVisibility() || !el.getClientRects().length || el.closest("[hidden],[inert]"))continue;
      const rect=el.getBoundingClientRect();
      const parent=el.closest<HTMLElement>(".field-cell,.form-field,.editor-group,.registration-card,.app-dialog-body")||el.parentElement!;
      const bounds=parent.getBoundingClientRect();
      if(rect.width && (rect.left<bounds.left-2||rect.right>bounds.right+2))bad.push(`${el.tagName}.${el.className}: child ${rect.left}..${rect.right} outside ${bounds.left}..${bounds.right}`);
      if(rect.width && (rect.left < -1 || rect.right>innerWidth+1))bad.push(`${el.tagName}#${el.id}[${el.getAttribute("data-testid")||el.getAttribute("aria-label")||""}]: outside viewport ${rect.left}..${rect.right}`);
    }
    return bad;
  }),{message:"Form children must settle inside their container and viewport"}).toEqual([]);
}

export async function expectPopupBounds(page:Page, selector:string) {
  const viewport=page.viewportSize()!;
  await expect.poll(async()=>{
    const rect=await page.locator(selector).last().boundingBox();
    return !!rect&&rect.x>=0&&rect.y>=0&&rect.x+rect.width<=viewport.width+1&&rect.y+rect.height<=viewport.height+1;
  },{message:`${selector} must settle within the viewport`}).toBe(true);
}
