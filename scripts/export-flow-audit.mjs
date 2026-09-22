import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const installed = await fs.readdir(path.join(root, "node_modules/.pnpm"));
const pkg = installed.find(name => name.startsWith("markdown-it@"));
if (!pkg) throw new Error("Install workspace dependencies before exporting the audit.");
const { default: MarkdownIt } = await import(pathToFileURL(path.join(root, "node_modules/.pnpm", pkg, "node_modules/markdown-it/index.mjs")).href);
const files = ["flow-integrity-report", "backend-flow-audit", "frontend-flow-audit", "api-verification", "browser-verification"];
const source = (await Promise.all(files.map(name => fs.readFile(path.join(root, `docs/audits/${name}.md`), "utf8")))).join("\n\n---\n\n");
const body = new MarkdownIt({ html: false }).render(source);
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ClinicFlow — Flow Integrity Audit</title><style>
body{font:15px/1.65 system-ui,sans-serif;color:#193431;background:#fafbf9;margin:0}main{max-width:1100px;margin:auto;padding:40px}
h1,h2,h3{line-height:1.25}h1{font-size:30px;color:#13786f}h2{margin-top:35px;font-size:23px;border-bottom:1px solid #dbe5e2;padding-bottom:8px}h3{font-size:18px}
table{border-collapse:collapse;width:100%;font-size:12px;table-layout:fixed;margin:20px 0}td,th{border:1px solid #dbe5e2;padding:8px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#eaf2ed}
code{font:0.86em ui-monospace,monospace;background:#eef3ef;overflow-wrap:anywhere}pre{white-space:pre-wrap;padding:15px;background:#eef3ef;overflow-wrap:anywhere}p,li{overflow-wrap:anywhere}hr{border:0;border-top:2px solid #dbe5e2;margin:55px 0}a{color:#13786f}
@media print{@page{size:A4;margin:16mm}body{font-size:10pt;background:white;color:#111}main{padding:0;max-width:none}h1{font-size:22pt;break-before:page}h1:first-child{break-before:auto}h2{font-size:16pt}h1,h2,h3{break-after:avoid}table{font-size:8pt}td,th{padding:5px}tr{break-inside:avoid}hr{break-after:page}}
@media(max-width:600px){main{padding:20px}table{font-size:10px}}
</style></head><body><main>${body}</main></body></html>`;
await fs.writeFile(path.join(root, "docs/audits/ClinicFlow-Flow-Integrity-Audit.html"), html);
console.log(`Exported ${files.length} audit/evidence sections.`);