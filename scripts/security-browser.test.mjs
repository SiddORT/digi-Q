// In-memory page only. No app login, patient data, network or provider calls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve, dirname, join } from "node:path";
import { chromium } from "@playwright/test";

test("jsPDF's DOMPurify strips XHTML SVG link rewriting without changing ordinary markup", async () => {
  const uiRequire = createRequire(resolve("artifacts/clinicflow/package.json"));
  const jspdfRequire = createRequire(uiRequire.resolve("jspdf"));
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.route("**/*", route => route.abort());
    await page.setContent("<!doctype html><title>Offline sanitizer fixture</title>");
    // Node resolves the CJS entry; use the package's adjacent browser UMD build.
    await page.addScriptTag({ path: join(dirname(jspdfRequire.resolve("dompurify")), "purify.js") });
    const result = await page.evaluate(() => {
      const purifier = window.DOMPurify;
      const dirty = '<svg xmlns="http://www.w3.org/2000/svg"><a><animate attributeName="href" values="x;javascript:alert(1)" dur="0.01s" fill="freeze"/><text>Ticket</text></a></svg>';
      return {
        version: purifier.version,
        svg: purifier.sanitize(dirty, {
          PARSER_MEDIA_TYPE: "application/xhtml+xml",
          ALLOWED_TAGS: ["svg", "a", "animate", "text"],
          ALLOWED_ATTR: ["attributeName", "values", "dur", "fill"],
        }),
        normal: purifier.sanitize("<p>Ticket <strong>TEST-ONLY</strong></p>"),
      };
    });
    assert.doesNotMatch(result.svg, /attributeName\s*=/i);
    assert.equal(result.normal, "<p>Ticket <strong>TEST-ONLY</strong></p>");
    console.log(`Verified DOMPurify ${result.version} in Chromium, with all network requests blocked`);
  } finally { await browser.close(); }
});

test("the patched deck editor mounts, edits and undoes with a single compatible model", async () => {
  const apiRequire = createRequire(resolve("artifacts/api-server/package.json"));
  const { build } = apiRequire("esbuild");
  const bundle = await build({
    stdin: {
      resolveDir: resolve("artifacts/clinicflow-project-deck"),
      contents: `
        import { Schema } from "prosemirror-model";
        import { EditorState } from "prosemirror-state";
        import { EditorView } from "prosemirror-view";
        import { history, undo } from "prosemirror-history";
        const schema = new Schema({nodes:{
          doc:{content:"paragraph+"}, paragraph:{content:"text*",toDOM:()=>["p",0]},text:{}
        }});
        const view = new EditorView(document.body,{
          state:EditorState.create({schema,plugins:[history()]})
        });
        view.dispatch(view.state.tr.insertText("Synthetic deck text"));
        const after=view.state.doc.textContent;
        const undone=undo(view.state,view.dispatch);
        window.editorResult={after,undone,restored:view.state.doc.textContent};
        view.destroy();
      `,
    },
    bundle: true, format: "iife", platform: "browser", write: false,
  });
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.route("**/*", route => route.abort());
    await page.setContent("<!doctype html><title>Offline editor fixture</title>");
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    assert.deepEqual(await page.evaluate(() => window.editorResult), {
      after: "Synthetic deck text", undone: true, restored: "",
    });
  } finally { await browser.close(); }
});
