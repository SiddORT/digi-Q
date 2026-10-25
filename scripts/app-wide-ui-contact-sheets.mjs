// Offline screenshot index for visual inspection; makes no application requests.
import {chromium} from "@playwright/test";
import {readdir,readFile,mkdir} from "node:fs/promises";
import {join} from "node:path";
const root="artifacts/clinicflow/workspace-regression/test-results/workspace";
const out="generated-artifacts/app-wide-ui/contact-sheets";
await mkdir(out,{recursive:true});
const records=[];
for(const dir of await readdir(root)){
  if(!dir.startsWith("app-wide-ui-"))continue;
  try{
    const result=JSON.parse(await readFile(join(root,dir,"route-result.json"),"utf8"));
    const image=await readFile(join(root,dir,"1366.png"));
    records.push({label:`${result.role} ${result.path}`,image:image.toString("base64")});
  }catch{/* Incomplete route records are blockers in the ledger, not silently accepted here. */}
}
records.sort((a,b)=>a.label.localeCompare(b.label));
const browser=await chromium.launch({executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]});
const page=await browser.newPage({viewport:{width:1536,height:650}});
const escape=s=>s.replaceAll("&","&amp;").replaceAll("<","&lt;");
for(let i=0;i<records.length;i+=6){
  await page.setContent(`<body style="margin:0;display:grid;grid-template-columns:repeat(3,512px);background:#ddd;font:12px sans-serif">${records.slice(i,i+6).map(r=>`<section style="height:325px"><header style="height:28px;padding:4px;box-sizing:border-box">${escape(r.label)}</header><img style="width:512px" src="data:image/png;base64,${r.image}"></section>`).join("")}</body>`);
  await page.locator("img").evaluateAll(imgs=>Promise.all(imgs.map(img=>(img).decode())));
  await page.screenshot({path:`${out}/sheet-${String(i/6+1).padStart(2,"0")}.jpg`,type:"jpeg",quality:85});
}
await browser.close();
console.log(`${records.length} route screenshots indexed in ${out}`);
