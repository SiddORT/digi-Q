import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Uses the Markdown renderer already installed in this pnpm workspace.
const root = path.resolve(import.meta.dirname, "..");
const packages = await fs.readdir(path.join(root, "node_modules/.pnpm"));
const rendererPackage = packages.find(name => name.startsWith("markdown-it@"));
if (!rendererPackage) throw new Error("Install the workspace dependencies before exporting documentation (markdown-it is required).");
const { default: MarkdownIt } = await import(pathToFileURL(path.join(root, "node_modules/.pnpm", rendererPackage, "node_modules/markdown-it/index.mjs")).href);
const chapters = [
  "docs/manual/00-overview.md",
  "docs/manual/01-user-guide.md",
  "docs/manual/02-backend.md",
  "docs/manual/03-operations.md",
];
const texts = await Promise.all(chapters.map(file => fs.readFile(path.join(root, file), "utf8")));
const contract = await fs.readFile(path.join(root, "lib/api-spec/openapi.yaml"), "utf8");
const markdown = texts.join("\n\n---\n\n") + `

---

# Appendix: Exact OpenAPI contract

This appendix reproduces the current interface definition from \`lib/api-spec/openapi.yaml\`. It includes every path, operation, parameter, request schema, response schema, field, enumerated value, required-field list, and declared constraint in that file. It is an interface reference, not evidence that every behavior has passed runtime acceptance testing. For implementation caveats, use the preceding chapters.

\`\`\`yaml
${contract.trimEnd()}
\`\`\`
`;
const md = new MarkdownIt({ html: false, linkify: false, typographer: false });
const tokens = md.parse(markdown, {});
const headings = [];
const seen = new Map();
for (let i = 0; i < tokens.length; i++) {
  const token = tokens[i];
  if (token.type !== "heading_open") continue;
  const title = tokens[i + 1].content;
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
  const count = (seen.get(base) || 0) + 1;
  seen.set(base, count);
  const id = count === 1 ? base : `${base}-${count}`;
  token.attrSet("id", id);
  if (["h1", "h2"].includes(token.tag)) headings.push({ title, id, level: token.tag });
}
const escape = value => md.utils.escapeHtml(value);
const toc = headings.map(h => `<a class="${h.level}" href="#${h.id}">${escape(h.title)}</a>`).join("\n");
const body = md.renderer.render(tokens, md.options, {});
const words = markdown.split(/\s+/).length;
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Complete source-based ClinicFlow system documentation: user guide, architecture, data, API, operations, security and limitations.">
<title>ClinicFlow — Complete System Documentation</title>
<style>
:root{color-scheme:light;--ink:#193431;--muted:#586b68;--line:#dbe5e2;--teal:#13786f}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:30px}body{margin:0;background:#fafbf9;color:var(--ink);font:16px/1.7 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
aside{position:fixed;inset:0 auto 0 0;width:290px;padding:26px 20px;overflow:auto;background:#eef4f0;border-right:1px solid var(--line)}
.brand{font-size:26px;font-weight:750;color:var(--teal);letter-spacing:-1px}.sub{color:var(--muted);font-size:12px;line-height:1.5;margin:6px 0 20px}.toc a{display:block;text-decoration:none;color:var(--ink);font-size:12px;line-height:1.5;padding:5px 7px;border-radius:5px}.toc a:hover{background:#dceae2}.toc .h1{font-size:13px;font-weight:750;margin-top:14px}.toc .h2{padding-left:15px}
main{margin-left:290px;padding:40px 5vw 100px;max-width:1600px}header{border-bottom:1px solid var(--line);display:flex;gap:15px;align-items:center;justify-content:space-between;padding-bottom:18px;margin-bottom:35px;color:var(--muted);font-size:13px}
button{border:0;background:var(--teal);color:white;padding:10px 16px;border-radius:7px;font:inherit;cursor:pointer}
h1,h2,h3,h4{line-height:1.25;letter-spacing:-.025em;overflow-wrap:anywhere}h1{font-size:35px;margin:65px 0 24px}h1:first-of-type{margin-top:0}h2{font-size:26px;margin:48px 0 18px;padding-bottom:10px;border-bottom:1px solid var(--line)}h3{font-size:20px;margin-top:32px}h4{font-size:17px;margin-top:26px}p,li{overflow-wrap:anywhere}li{margin:5px 0}a{color:var(--teal)}
table{border-collapse:collapse;display:block;max-width:100%;overflow-x:auto;font-size:13px;line-height:1.6;margin:22px 0;width:100%}th,td{padding:10px 12px;text-align:left;border:1px solid var(--line);vertical-align:top;min-width:100px}th{background:#e9f2ee;font-weight:700}tr:nth-child(even) td{background:#f4f7f4}
code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.85em;background:#eaf0ec;padding:2px 5px;border-radius:4px;overflow-wrap:anywhere}pre{padding:20px;background:#172f2c;color:#edf7f2;border-radius:9px;overflow:auto;line-height:1.6;font-size:13px}pre code{padding:0;background:transparent;color:inherit;border-radius:0}
blockquote{margin:20px 0;border-left:4px solid var(--teal);padding:8px 20px;background:#edf4ef;color:var(--muted)}hr{border:0;border-top:2px solid var(--line);margin:60px 0}
.footer{font-size:12px;color:var(--muted);margin-top:60px}
@media(max-width:950px){aside{position:relative;width:auto;max-height:360px;border-bottom:1px solid var(--line);border-right:0}main{margin-left:0;padding:24px 20px 65px}h1{font-size:29px}h2{font-size:23px}}
@media print{@page{size:A4;margin:18mm}aside,header{display:none}body{background:white;font-size:10pt;color:#111}main{margin:0;padding:0;max-width:none}h1{font-size:23pt;break-before:page}h1:first-of-type{break-before:auto}h2{font-size:17pt}h3{font-size:13pt}h1,h2,h3,h4{break-after:avoid}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f2f5f3;color:#111;font-size:8pt;overflow:visible}table{display:table;table-layout:fixed;font-size:8pt;width:100%;overflow:visible}th,td{min-width:0;padding:5px;word-break:break-word}tr{break-inside:avoid}a{color:#111;text-decoration:none}hr{break-after:page}button{display:none}}
</style></head><body><aside aria-label="Document navigation"><div class="brand">ClinicFlow</div><div class="sub">COMPLETE SYSTEM DOCUMENTATION<br>Source snapshot · 22 September 2026<br>${words.toLocaleString("en-US")} words · Offline-ready edition</div><nav class="toc">${toc}</nav></aside>
<main><header><span>User guide · Technical reference · Operations · API contract<br>Use Ctrl/Cmd + F to search this document.</span><button onclick="window.print()">Print / Save as PDF</button></header>${body}
<p class="footer">Generated from version-controlled documentation and the API contract. No external assets, analytics, credentials, or application connections are required to read this file.</p></main></body></html>`;
await fs.writeFile(path.join(root, "docs/ClinicFlow-System-Documentation.md"), markdown);
await fs.writeFile(path.join(root, "docs/ClinicFlow-System-Documentation.html"), html);
console.log(JSON.stringify({ chapters: chapters.length, words, headings: headings.length, markdownBytes: Buffer.byteLength(markdown), htmlBytes: Buffer.byteLength(html) }));