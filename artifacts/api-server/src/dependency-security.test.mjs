// Offline compatibility checks for security updates. Synthetic identities only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { gzipSync } from "node:zlib";
const require = createRequire(import.meta.url);
const expressRequire = createRequire(require.resolve("express"));

test("proxy subnet fix rejects unmapped IPv4 trust while preserving configured hop semantics", () => {
  const proxyaddr = expressRequire("proxy-addr");
  assert.equal(proxyaddr.compile("::/1")("203.0.113.1"), false);
  assert.equal(proxyaddr.compile("::ffff:10.0.0.0/8")("203.0.113.1"), false);
  assert.equal(proxyaddr.compile("::ffff:10.0.0.0/104")("10.1.2.3"), true);
  assert.equal(proxyaddr.compile("10.0.0.0/8")("203.0.113.1"), false);
});

test("Express JSON, nested forms, limits and forwarded-hop behavior remain compatible", () => {
  // A child process also catches delayed uncaught decompression errors, which
  // cannot safely be asserted inside the main test runner.
  const result = spawnSync(process.execPath, ["--input-type=commonjs", "-"], {
    cwd: import.meta.dirname, encoding: "utf8", timeout: 15000,
    input: `
      const assert=require('node:assert/strict'),express=require('express'),http=require('node:http');
      const app=express(); app.set('trust proxy',1);
      app.use(express.json({limit:'128kb'}));app.use(express.urlencoded({extended:true}));
      app.post('/echo',(req,res)=>res.json({body:req.body,ip:req.ip,ips:req.ips}));
      app.use((err,req,res,next)=>res.status(err.status||500).end());
      const server=app.listen(0,'127.0.0.1',async()=>{
        const port=server.address().port;
        const request=(body,headers)=>new Promise((resolve,reject)=>{
          const req=http.request({host:'127.0.0.1',port,path:'/echo',method:'POST',headers,agent:false},res=>{
            let data='';res.on('data',d=>data+=d);res.on('end',()=>resolve({status:res.statusCode,data}));
          });req.on('error',reject);req.end(body);
        });
        try {
          let r=await request('{"name":"Synthetic Patient"}',{'content-type':'application/json','x-forwarded-for':'198.51.100.5, 203.0.113.9'});
          assert.equal(r.status,200);assert.equal(JSON.parse(r.data).ip,'203.0.113.9');
          assert.equal(JSON.parse(r.data).body.name,'Synthetic Patient');
          r=await request('patient[name]=Synthetic&__proto__[polluted]=true',{'content-type':'application/x-www-form-urlencoded'});
          assert.equal(r.status,200);assert.equal(JSON.parse(r.data).body.patient.name,'Synthetic');
          assert.equal({}.polluted,undefined);
          r=await request('{"x":"'+ 'a'.repeat(140000)+'"}',{'content-type':'application/json'});
          assert.equal(r.status,413);
          r=await request('{broken',{'content-type':'application/json'});assert.equal(r.status,400);
          r=await request(Buffer.from('${gzipSync('{"safe":true}').toString("base64")}','base64'),{'content-type':'application/json','content-encoding':'gzip'});
          assert.equal(r.status,200);assert.equal(JSON.parse(r.data).body.safe,true);
          try {
            r=await request(Buffer.concat([Buffer.from('${gzipSync('{"safe":true}').toString("base64")}','base64'),Buffer.from('trailing-invalid')]),{'content-type':'application/json','content-encoding':'gzip'});
            assert.ok([200,400].includes(r.status));
          } catch(e) { assert.ok(['ECONNRESET','EPIPE'].includes(e.code)); }
          await new Promise(resolve=>setTimeout(resolve,100));
          r=await request('{}',{'content-type':'application/json'});assert.equal(r.status,200);
          server.close();
        } catch(e) {console.error(e);server.close();process.exitCode=1}
      });
    `,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});

test("real Nodemailer composes PDF attachments without contacting SMTP or misrouting comments", async () => {
  const nodemailer = require("nodemailer");
  const { jsPDF } = require("jspdf");
  const pdf = new jsPDF(); pdf.text("Synthetic ticket", 10, 10);
  const transport = nodemailer.createTransport({
    streamTransport: true, buffer: true, newline: "unix",
    disableFileAccess: true, disableUrlAccess: true,
  });
  try {
    for (const recipient of [
      "Patient <patient@example.test>",
      "Patient (x(y) <other@example.invalid>) <patient@example.test>",
      "G: (a; <other@example.invalid>) <patient@example.test>;",
    ]) {
      const info = await transport.sendMail({
        from: "clinic@example.test", to: recipient, subject: "Synthetic ticket",
        text: "Test only", html: "<p>Test only</p>",
        attachments: [{ filename: "ticket.pdf", content: Buffer.from(pdf.output("arraybuffer")), contentType: "application/pdf" }],
      });
      assert.deepEqual(info.envelope.to, ["patient@example.test"]);
      const message = info.message.toString();
      assert.match(message, /Content-Type: application\/pdf/);
      assert.match(message, /filename=ticket\.pdf/);
    }
    await assert.rejects(transport.sendMail({
      from: "clinic@example.test", to: "patient@example.test", text: "test",
      attachments: [{ path: "/definitely-not-a-real-fixture-file" }],
    }), /File access rejected/i);
    await assert.rejects(transport.sendMail({
      from: "clinic@example.test", to: "patient@example.test", text: "test",
      attachments: [{ path: "https://example.invalid/no-network" }],
    }), /Url access rejected/i);
  } finally { transport.close(); }
});

test("Google storage parent constructs offline and its XML parser handles normal metadata", () => {
  const { Storage } = require("@google-cloud/storage");
  const storage = new Storage({ projectId: "synthetic-project", credentials: { client_email: "fixture@example.test", private_key: "unused-no-network" } });
  assert.equal(storage.bucket("synthetic-bucket").file("ticket.pdf").name, "ticket.pdf");
  const storageRequire = createRequire(require.resolve("@google-cloud/storage"));
  const { XMLParser } = storageRequire("fast-xml-parser");
  assert.deepEqual(new XMLParser().parse("<List><Key>ticket.pdf</Key></List>"), { List: { Key: "ticket.pdf" } });
});

test("rate-limit IP parser rejects oversized malformed zone IDs without changing IPv6 keys", () => {
  const rateRequire = createRequire(require.resolve("express-rate-limit"));
  const { Address6 } = rateRequire("ip-address");
  assert.equal(Address6.isValid("2001:db8::1"), true);
  assert.equal(Address6.isValid("fe80::1%eth0"), true);
  assert.equal(Address6.isValid("%".repeat(10000) + "\n"), false);
  const { ipKeyGenerator } = require("express-rate-limit");
  assert.equal(ipKeyGenerator("203.0.113.4"), "203.0.113.4");
  assert.equal(ipKeyGenerator("2001:db8::1"), ipKeyGenerator("2001:db8::2"));
});
