// Development-only explicit maintenance. Never sends or contacts a provider.
import { build } from "esbuild";
import { resolve } from "node:path";
import { rm } from "node:fs/promises";
import { createRequire } from "node:module";
const output=resolve(import.meta.dirname,`.appointment-registration-${process.pid}.mjs`);
try {
  if(process.env.NODE_ENV!=="development") throw new Error("This command is restricted to workspace development");
  await build({
    stdin:{contents:`export * from "./lib/appointment-template-registration"; export * from "./lib/appointment-notification-activation"; export {pool} from "@workspace/db";`,
      resolveDir:import.meta.dirname,loader:"ts"},
    outfile:output,bundle:true,platform:"node",format:"esm",packages:"external",
    plugins:[{name:"workspace-db",setup(b){
      b.onResolve({filter:/^@workspace\/db$/},()=>({path:resolve(import.meta.dirname,"../../../lib/db/src/index.ts")}));
      b.onResolve({filter:/^pg$/},()=>({path:createRequire(resolve(import.meta.dirname,"../../../lib/db/package.json")).resolve("pg"),external:true}));
    }}],
  });
  const api=await import(output);
  try {
    const before=await api.appointmentActivationInventory();
    const result=process.argv.includes("--apply-workspace-development")
      ?await api.registerAppointmentTemplates(before.revision):{readOnly:true};
    console.log(JSON.stringify({environment:"workspace development database only",result,
      inventory:await api.appointmentActivationInventory()},null,2));
  } finally {await api.pool.end();}
} finally {await rm(output,{force:true});}
