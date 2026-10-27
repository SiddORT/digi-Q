import { test, expect, type Page } from "@playwright/test";

async function bounds(page:Page) {
  return page.evaluate(()=>{
    const list=document.querySelector(".listing-region")!, footer=list.querySelector(".pagination")!;
    const body=list.querySelector(".table-scroll,.empty,[role=status],[role=alert]")!;
    const r=list.getBoundingClientRect(), f=footer.getBoundingClientRect(), b=body.getBoundingClientRect();
    return {bottom:r.bottom,footer:f.top,body:b.bottom,height:r.height,overflow:document.documentElement.scrollWidth-innerWidth,position:getComputedStyle(footer).position};
  });
}
for(const width of [390,768,1024,1440])test(`shared shell header and local footer ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:900});
  await page.route("**/api/**",route=>route.abort());
  await page.goto("/?mode=header-pagination");
  const heading=page.getByRole("heading",{level:1});
  await expect(heading).toHaveText("Appointments");
  const row=page.getByTestId("list-header-search-row");
  await expect(row.locator("h1")).toHaveCount(1);
  await expect(row.getByTestId("fixture-export")).toBeVisible();
  await expect(row.getByTestId("fixture-add")).toBeVisible();
  if(width===1440){
    const rects=await row.locator("h1,input[type=search],[data-testid=button-toggle-advanced-filters],[data-testid=fixture-export],[data-testid=fixture-add]").evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {y:r.y,h:r.height};}));
    expect(Math.max(...rects.map(r=>r.y+r.h/2))-Math.min(...rects.map(r=>r.y+r.h/2))).toBeLessThan(3);
  }
  const initial=await bounds(page);
  expect(initial.footer-initial.body).toBeGreaterThan(30);
  expect(initial.position).toBe("static");
  for(const count of [0,2,20,22]){
    await page.getByRole("button",{name:`${count} results`,exact:true}).click();
    await expect(page.getByRole("navigation",{name:"Pagination"})).toContainText(count?`1–${Math.min(count,20)}`:"0–0");
    if(count===0)await expect(page.getByRole("button",{name:"Next page",exact:true})).toBeDisabled();
    if(count===22){
      await page.getByRole("button",{name:"Last page",exact:true}).click();
      await expect(page.locator(".pagination")).toContainText("21–22");
      const short=await bounds(page);expect(Math.abs(short.bottom-initial.bottom)).toBeLessThan(3);
    }
    const r=await bounds(page);expect(r.footer).toBeGreaterThanOrEqual(r.body-1);expect(r.overflow).toBeLessThanOrEqual(1);
  }
  await page.getByRole("button",{name:"2 results",exact:true}).click();
  for(const state of ["loading","error"]){
    await page.getByRole("button",{name:state,exact:true}).click();
    await expect(page.locator(".pagination")).toContainText(state==="loading"?"Loading results":"Results unavailable");
    await expect(page.getByRole("button",{name:"Next page",exact:true})).toBeDisabled();
    expect(Math.abs((await bounds(page)).bottom-initial.bottom)).toBeLessThan(3);
  }
  await page.getByRole("button",{name:"ready",exact:true}).click();
  await page.getByRole("button",{name:"22 results",exact:true}).click();
  await page.getByRole("button",{name:/^Rows per Page:/}).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("option",{name:"10",exact:true}).click();
  await expect(page.locator(".pagination")).toContainText("1–10");
  await expect(page.locator(".pagination")).toContainText("Page 1 of 3");
  await page.getByRole("button",{name:/^Rows per Page:/}).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("option",{name:"20",exact:true}).click();
  await page.getByRole("button",{name:"2 results",exact:true}).click();
  await page.getByRole("searchbox").fill("Fictional");
  await expect(page.locator("tbody>tr")).toHaveCount(2);
  await page.getByRole("searchbox").fill("");
  await page.screenshot({path:info.outputPath(`two-results-${width}.png`)});
  await page.getByTestId("button-toggle-advanced-filters").click();
  await page.getByRole("checkbox",{name:"Only matching records"}).check();
  await page.getByTestId("button-close-filters").click();
  await expect(page.getByRole("list",{name:"Active filters"})).toContainText("Matching records");
  await page.getByTestId("button-toggle-advanced-filters").focus();
  await page.keyboard.press("Enter");await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button",{name:"Details 1",exact:true}).click();
  const expanded=page.getByTestId("fixture-expanded");
  const a=(await expanded.boundingBox())!, b=(await page.locator(".pagination").boundingBox())!;
  expect(b.y).toBeGreaterThanOrEqual(a.y+a.height);
  await page.getByRole("tab",{name:"Nested panel"}).click();
  await expect(page.locator("h1:visible")).toHaveCount(1);
  await page.getByRole("tab",{name:"Form",exact:true}).click();
  await expect(page.locator("h1:visible")).toHaveText("Account details");
  await expect(page.getByRole("navigation",{name:"Pagination"})).toHaveCount(0);
  await page.screenshot({path:info.outputPath(`form-${width}.png`)});
});
