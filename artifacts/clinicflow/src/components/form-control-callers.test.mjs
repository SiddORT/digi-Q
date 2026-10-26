import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { transform } from "esbuild";
const require = createRequire(import.meta.url);

// Invoke production caller handlers without a DOM or network. Child widgets are
// opaque elements here; shared-widget behavior has its own tests. State/effects
// are synchronous so the assertions concern the caller's save/scope boundary.
async function caller(file, exports, imports = {}) {
  const states = []; let cursor = 0; let effects = [];
  const react = { ...require("react"),
    useState(initial) { const i=cursor++; if (!(i in states)) states[i]=typeof initial==="function"?initial():initial; return [states[i], next=>{states[i]=typeof next==="function"?next(states[i]):next;}]; },
    useEffect(fn) { effects.push(fn); }, useRef(value) { return {current:value}; },
    useCallback(fn) { return fn; }, useId() { return "fictional-control"; },
  };
  const children = new Proxy({__esModule:true}, { get(target,key) { return key in target ? target[key] : String(key); } });
  const result = await transform(readFileSync(new URL(file,import.meta.url),"utf8")+`\nexport {${exports}};`,{loader:"tsx",format:"cjs",jsx:"automatic"});
  const m={exports:{}};
  new Function("require","module","exports",result.code)(name=>name==="react"?react:name==="react/jsx-runtime"?require(name):(imports[name]??children),m,m.exports);
  return {states, render(name,props) {cursor=0;effects=[];const tree=m.exports[name](props);for(const fn of effects) fn();return tree;}};
}
function find(node, predicate) {
  if (!node || typeof node !== "object") return undefined;
  if (predicate(node)) return node;
  return [node.props?.children].flat(Infinity).map(n=>find(n,predicate)).find(Boolean);
}
const byId=(tree,id)=>find(tree,n=>n.props?.["data-testid"]===id||n.props?.id===id);

test("provider switch edits only the draft; save still requires the existing password dialog and revision",async()=>{
  const writes=[]; const dirty=[];
  const save={isPending:false,reset(){},mutate(value){writes.push(value);}};
  const api={useUpdateIntegrationSettings:()=>save,useSendSmtpTestEmail:()=>({isPending:false,reset(){},mutate(){throw Error("No message allowed");}}),
    getGetIntegrationSettingsQueryKey:()=>["fixture"],getGetSmtpTestReceiptQueryKey:()=>["receipt"]};
  const h=await caller("./EmailProviderPanel.tsx","EmailForm",{
    "@workspace/api-client-react":api,
    "@tanstack/react-query":{useQueryClient:()=>({setQueryData(){},invalidateQueries(){}})},
    "./ConfirmDialog":{useConfirm:()=>({ask:async()=>false})},
  });
  const props={r:{ready:true,keys:[{key:"SMTP_PORT",status:"configured"}],revision:"fixture-revision",smtpHost:"smtp.example.com",smtpPort:587,fromEmail:"fictional@example.com",notificationsEnabled:true,useTls:true,useSsl:false},editable:true,onDirty:v=>dirty.push(v),onBusy(){}};
  let tree=h.render("EmailForm",props);
  const control=find(tree,n=>n.type==="StatusSwitch");
  assert.ok(control);control.props.onChange(false);
  assert.equal(writes.length,0);
  tree=h.render("EmailForm",props);
  assert.equal(dirty.at(-1),true);
  assert.equal(byId(tree,"button-save-smtp-settings").props.disabled,false);
  byId(tree,"button-save-smtp-settings").props.onClick();
  assert.equal(writes.length,0);
  tree=h.render("EmailForm",props);
  assert.ok(find(tree,n=>n.type==="AppDialog"&&n.props.title==="Confirm your password"));
  assert.equal(byId(tree,"button-confirm-smtp-save").props.disabled,true);
  byId(tree,"em-pw").props.onChange({target:{value:"fictional-password-not-a-credential"}});
  tree=h.render("EmailForm",props);
  find(tree,n=>n.type==="form").props.onSubmit({preventDefault(){}});
  assert.equal(writes.length,1);
  assert.equal(writes[0].data.revision,"fixture-revision");
  assert.equal(writes[0].data.values.SMTP_NOTIFICATIONS_ENABLED,"false");
  assert.equal(writes[0].data.values.SMTP_PASSWORD,undefined);
  assert.equal(writes[0].data.values.SMTP_USER,undefined);
  byId(tree,"em-from").props.onChange({target:{value:"not-an-email"}});
  tree=h.render("EmailForm",props);
  assert.equal(byId(tree,"button-save-smtp-settings").props.disabled,true);
  assert.equal(byId(tree,"em-from").props["aria-invalid"],true);
  assert.equal(writes.length,1);
});

test("visit handoff offers only supplied doctor locations and invalidates removed scope before inclusion",async()=>{
  const included=[];
  const available={available:true,startTime:"09:00",sessionId:"s1"};
  const h=await caller("./StaffDeletionReview.tsx","VisitMove",{
    "./queue/SessionSelector":{SessionSelector:"SessionSelector",useDailySession:()=>({sessionId:"s1",availability:{data:available,isFetching:false}})},
  });
  const props={visit:{id:"v1",date:"2030-01-01",revision:7},doctors:[{id:"d1",fullName:"Fictional Doctor",branches:[{id:"b1",name:"Authorized Location",clinicId:"c1"}]}],onMove:(...args)=>included.push(args)};
  let tree=h.render("VisitMove",props);
  const doctor=byId(tree,"mv-v1-d");
  assert.deepEqual(doctor.props.options.map(o=>o.value),["d1"]);
  doctor.props.onChange("d1");tree=h.render("VisitMove",props);
  assert.deepEqual(byId(tree,"mv-v1-b").props.options.map(o=>o.value),["b1"]);
  byId(tree,"mv-v1-b").props.onChange("b1");tree=h.render("VisitMove",props);
  byId(tree,"mv-v1-t").props.onChange("2030-01-01");tree=h.render("VisitMove",props);
  assert.equal(included.at(-1)[1].expectedRevision,7);
  assert.equal(included.at(-1)[1].branchId,"b1");
  tree=h.render("VisitMove",{...props,doctors:[{...props.doctors[0],branches:[]}]});
  assert.equal(included.at(-1)[1],null);
  tree=h.render("VisitMove",props);
  byId(tree,"mv-v1-t").props.onChange("");tree=h.render("VisitMove",props);
  assert.equal(included.at(-1)[1],null);
  byId(tree,"mv-v1-d").props.onChange("");tree=h.render("VisitMove",props);
  assert.equal(byId(tree,"mv-v1-b"),undefined);
  assert.equal(included.at(-1)[1],null);
});

test("responsibility handoff cannot review a removed or unauthorized administrator",async()=>{
  const result={data:{admins:[{id:"admin1",fullName:"Fictional Admin",email:"fictional@example.com"}],doctors:[],visits:[]},isError:false};
  const h=await caller("./StaffDeletionReview.tsx","Handoff",{"@tanstack/react-query":{useQuery:()=>result}});
  const props={userId:"fixture",kind:"clinic-responsibilities",version:"revision",disabled:false,onBusy(){},onClose(){},onCommitted(){throw Error("No commit allowed");}};
  const review=tree=>find(tree,n=>n.type==="button"&&n.props.onClick&&n.props.children==="Review handoff");
  let tree=h.render("Handoff",props);
  const picker=find(tree,n=>n.type==="SearchableSelect");
  assert.deepEqual(picker.props.options.map(o=>o.value),["admin1"]);
  assert.equal(review(tree).props.disabled,true);
  picker.props.onChange("admin1");tree=h.render("Handoff",props);
  assert.equal(review(tree).props.disabled,false);
  result.data.admins=[];tree=h.render("Handoff",props);
  assert.equal(review(tree).props.disabled,true);
  result.data.admins=[{id:"admin1",fullName:"Fictional Admin"}];result.isError=true;
  tree=h.render("Handoff",props);assert.equal(review(tree).props.disabled,true);
});
