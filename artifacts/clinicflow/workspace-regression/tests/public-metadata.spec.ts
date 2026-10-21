import {test,expect} from "@playwright/test";

test("actual public slug routes use persisted names and configured canonical origin; auth and booking are noindex",async({page})=>{
 const clinic={id:"metadata-clinic",name:"Persisted Care Clinic",slug:"persisted-care",address:"10 Saved Road",status:"active"};
 const branch={id:"metadata-branch",clinicId:clinic.id,name:"Saved Location",slug:"saved-location",address:"20 Location Road",timezone:"Asia/Kolkata",status:"active"};
 await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,route=>route.abort());
 await page.route("**/api/**",async route=>{
  const path=new URL(route.request().url()).pathname;
  let status=200,body:any;
  if(path==="/api/auth/status")body={authenticated:false,user:null};
  else if(path==="/api/me"){status=401;body={message:"Sign in required"};}
  else if(path==="/api/public/website-config")body={publicOrigin:"https://configured-clinics.test"};
  else if(path.startsWith("/api/public/clinics-by-slug/persisted-care"))body={clinic,branches:[branch],branch:path.endsWith("/saved-location")?branch:null,doctors:[],branchCount:1,directoryPagination:{page:1,total:0,totalPages:1,pageSize:20}};
  else {status=404;body={message:"No fixture for this endpoint"};}
  await route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
 });
 await page.goto("/persisted-care?mode=app");
 await expect(page).toHaveTitle("Persisted Care Clinic | DigiQ Doctors");
 await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content","index, follow");
 await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href","https://configured-clinics.test/persisted-care");
 await expect(page.locator('meta[name="description"]')).toHaveAttribute("content",/10 Saved Road/);
 await page.goto("/persisted-care/saved-location?mode=app");
 await expect(page).toHaveTitle("Saved Location · Persisted Care Clinic | DigiQ Doctors");
 await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href","https://configured-clinics.test/persisted-care/saved-location");
 await expect(page.locator('meta[name="description"]')).toHaveAttribute("content",/20 Location Road/);
 await page.goto("/persisted-care/saved-location?mode=app&display=1");
 await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content","noindex, nofollow");
 await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
 await page.goto("/sign-in?mode=app");
 await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content","noindex, nofollow");
 await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
 await page.goto("/admin/clinics/metadata-clinic/details?mode=app");
 await expect(page).toHaveURL(/\/sign-in/);
 await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content","noindex, nofollow");
});
