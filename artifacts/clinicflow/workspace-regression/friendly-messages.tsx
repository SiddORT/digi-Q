import { Suspense, lazy, useState } from "react";
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { RegistrationEmailNotice } from "../src/auth/RegistrationEmailNotice";
import { SecurityChannelNotice } from "../src/auth/SecurityChannelNotice";
import { ExactRecordDrawer } from "../src/components/RecordDetails";
import { TicketEmailDialog } from "../src/components/appointments/TicketEmailDialog";
import { WorkspaceSearch } from "../src/components/WorkspaceSearch";
import { ErrorBoundary } from "../src/components/error-boundary";
import { RecoveryActions } from "../src/components/RecoveryActions";
import { NativeAuthProvider } from "../src/auth/native-auth";
import "./workspace.css";
import "../src/form-standard.css";
import "../src/compact-ui.css";

// Fail closed when opened outside an intercepted browser test. No real API
// requests, credentials, bookings or transports are permitted in this fixture.
const originalFetch=window.fetch.bind(window);
window.fetch=(input,init)=>{
  const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url,window.location.href);
  if(url.pathname.startsWith("/api/")&&sessionStorage.getItem("friendly-fixture-intercepted")!=="yes")
    return Promise.resolve(new Response(JSON.stringify({error:"Fictional fixture: no live requests."}),{status:503,headers:{"Content-Type":"application/json"}}));
  return originalFetch(input,init);
};
const params=new URLSearchParams(window.location.search);
const PatientLogin=lazy(()=>import("../src/auth/PatientLogin").then(m=>({default:m.PatientLogin})));
const Registration=lazy(()=>import("../src/components/ClinicRegistration").then(m=>({default:m.ClinicRegistration})));
const Password=lazy(()=>import("../src/auth/PasswordFlows").then(m=>({default:m.SetPassword})));
const Demo=lazy(()=>import("../src/auth/DemoLogin").then(m=>({default:m.DemoLogin})));
const Staff=lazy(()=>import("../src/auth/StaffLogin").then(m=>({default:m.StaffLogin})));
const Email=lazy(()=>import("../src/components/EmailProviderPanel").then(m=>({default:m.EmailProviderPanel})));
const Sms=lazy(()=>import("../src/components/NotificationSmsSettings").then(m=>({default:m.NotificationSmsSettings})));
function Crash():never{throw new Error("HTTP 500 SQL provider payload PRIVATE_DIAGNOSTIC");}
function RecordFixture(){
  const [open,setOpen]=useState(true);
  const query=useQuery({queryKey:["fictional-record"],queryFn:()=>customFetch<{name:string}>("/api/fictional-record"),retry:false});
  return open?<ExactRecordDrawer title="Fictional record" query={query} onClose={()=>setOpen(false)}>{row=><p>{row.name}</p>}</ExactRecordDrawer>:<p>Record closed</p>;
}
function Fixture(){
  const [open,setOpen]=useState(true);
  const mode=params.get("fixture")||"security";
  if(mode==="record")return <RecordFixture/>;
  if(mode==="tickets")return open?<TicketEmailDialog open items={[{id:"one",label:"Fictional visit one"},{id:"two",label:"Fictional visit two"},{id:"three",label:"Fictional visit three"}]} onClose={()=>setOpen(false)}/>:<p>Tickets closed</p>;
  if(mode==="search"){
    const role=params.get("role")||"admin";
    const navigation=role==="patient"?["dashboard","appointments","book","profile"]:["dashboard","appointments","patients","clinics","queue","profile"];
    return <WorkspaceSearch role={role} navigation={navigation} page="dashboard" userId={`fictional-${role}`}/>;
  }
  if(mode==="crash")return <ErrorBoundary><Crash/></ErrorBoundary>;
  if(mode==="wait")return <RecoveryActions error={{status:429,retryAfterSeconds:3}} onRetry={()=>Promise.resolve()}/>;
  if(mode==="email")return <Email/>;
  if(mode==="sms")return <Sms inline/>;
  if(["registration","patient","password","demo","staff"].includes(mode))return <NativeAuthProvider>{mode==="registration"?<Registration/>:mode==="patient"?<PatientLogin/>:mode==="password"?<Password/>:mode==="demo"?<Demo/>:<Staff/>}</NativeAuthProvider>;
  return <main className="panel padded" style={{maxWidth:720,margin:"24px auto"}}><h1>Fictional verification messages</h1>{["provider_accepted","provider_rejected","pre_dispatch_failed","delivery_unknown","unavailable","disabled"].map(status=><section key={status} style={{marginBottom:20}}><h2>{status==="provider_accepted"?"Check for your code":status==="delivery_unknown"?"Sending couldn’t be confirmed":status==="disabled"?"Sending is turned off":status==="unavailable"?"Messaging is unavailable":"Email couldn’t be sent"}</h2><RegistrationEmailNotice channels={{email:{status}}}/></section>)}<SecurityChannelNotice channels={{email:{status:"not_reported"}}}/></main>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><Router><Suspense fallback={<p role="status">Loading fictional fixture…</p>}><Fixture/></Suspense></Router></QueryClientProvider>);
