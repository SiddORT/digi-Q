// Read-only source inventory. Writes only this report directory.
const ts = require("typescript");
const fs = require("node:fs");
const path = require("node:path");
const root = "artifacts/clinicflow/src";
const out = __dirname;
const files = [];
function walk(dir) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${d.name}`;
    if (d.isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?)$/.test(p) && !/\.(test|spec)\./.test(p)) files.push(p);
  }
}
walk(root);
const graph = {}, records = [], modules = {};
for (const file of files.sort()) {
  const text = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const deps = [];
  function add(node, kind, value) {
    const copy = value.replace(/\s+/g, " ").trim();
    if (!copy || !/[a-zA-Z]/.test(copy)) return;
    let parent = node, owner = "module";
    while (parent) {
      if ((ts.isFunctionDeclaration(parent) || ts.isMethodDeclaration(parent)) && parent.name) { owner = parent.name.getText(sf); break; }
      if (ts.isVariableDeclaration(parent) && parent.initializer && (ts.isArrowFunction(parent.initializer) || ts.isFunctionExpression(parent.initializer))) { owner = parent.name.getText(sf); break; }
      parent = parent.parent;
    }
    records.push({file, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, owner, kind, copy});
  }
  function visit(n) {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) {
      const name = n.moduleSpecifier.text;
      const base = name.startsWith(".") ? path.join(path.dirname(file), name) : name.startsWith("@/") ? `${root}/${name.slice(2)}` : null;
      if (base) {
        const resolved = [base, `${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
        if (resolved) deps.push(resolved);
      }
    }
    if (ts.isJsxText(n)) add(n, "rendered text", n.text);
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n)) {
      const p = n.parent;
      const value = ts.isTemplateExpression(n) ? n.getText(sf) : n.text;
      if (ts.isJsxAttribute(p) && /^(text|help|helper|title|description|message|emptyText|loadingText|placeholder|label|aria-label)$/.test(p.name.getText(sf))) add(n, "UI attribute", value);
      else if (!ts.isImportDeclaration(p) && /\s/.test(value) && /[a-zA-Z]{3}/.test(value) && !/^(className|style)$/.test(p.name?.getText?.(sf) || "")) {
        if (!(ts.isJsxAttribute(p) && /^(className|data-|id)/.test(p.name.getText(sf))))
          add(n, "expression / candidate (trace required)", value);
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(sf); graph[file] = deps;
  modules[file] = {lines: text.split("\n").length};
}
const linked = new Set();
function link(file) { if (linked.has(file)) return; linked.add(file); (graph[file] || []).forEach(link); }
link(`${root}/main.tsx`);
for (const r of records) r.moduleLinked = linked.has(r.file);
const unique = records.filter((r, i, all) => !all.slice(0, i).some(a => a.file === r.file && a.line === r.line && a.copy === r.copy));
const data = {notice: "Module-linked is not proof of branch visibility. Expression candidates include non-visible implementation strings; only the curated review assigns findings.", files: Object.entries(modules).map(([file, info]) => ({file, ...info, moduleLinked: linked.has(file), candidates: unique.filter(r => r.file === file).length})), graph, records: unique};
fs.writeFileSync(`${out}/source-index.json`, JSON.stringify(data, null, 2) + "\n");
const esc = s => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const sections = data.files.filter(f => f.candidates).map(f => `<details><summary>${esc(f.file)} — ${f.candidates} fragments · ${f.moduleLinked ? "module linked" : "not statically linked"}</summary><table><tr><th>Source / owner</th><th>Evidence category</th><th>Exact text or expression</th></tr>${unique.filter(r => r.file === f.file).map(r => `<tr><td>L${r.line} · ${esc(r.owner)}</td><td>${esc(r.kind)}</td><td>${esc(r.copy)}</td></tr>`).join("")}</table></details>`).join("");
fs.writeFileSync(`${out}/source-index.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><title>ClinicFlow message source index</title><style>body{font:15px system-ui;margin:32px;line-height:1.5;color:#183239}table{border-collapse:collapse;width:100%;margin:12px 0}td,th{border:1px solid #ccd9da;padding:8px;text-align:left;vertical-align:top;overflow-wrap:anywhere}td:first-child{width:18%}summary{padding:12px;background:#eef5f4;cursor:pointer}details{margin:8px 0}h1{font-size:28px}</style><h1>ClinicFlow message source index</h1><p>Companion evidence, not the approval list. ${esc(data.notice)} No records, credentials or provider responses were read. Application source only.</p><p>${data.files.length} source modules; ${linked.size} statically linked modules; ${unique.length} source fragments. Text may include headings, labels and code strings outside the message audit. Use the curated review for decisions.</p>${sections}</html>`);
console.log(JSON.stringify({modules:data.files.length,linked:linked.size,fragments:unique.length}));
