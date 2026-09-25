import { useEffect, useRef } from "react";
import { ClerkProvider, useAuth, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route, Switch, Redirect, Link, useLocation } from "wouter";
import { Activity, ArrowUpRight, CalendarDays, ShieldCheck, Clock3, Building2, Stethoscope, ChevronRight } from "lucide-react";
import * as api from "@workspace/api-client-react";
import { Portal, Onboarding, PublicBooking } from "./clinic";
import { CheckInScanner } from "./CheckIn";
import { StaffLogin } from "./auth/StaffLogin";
import { PatientLogin } from "./auth/PatientLogin";
import { ForgotPassword, SetPassword } from "./auth/PasswordFlows";
import { AuthAccess } from "./auth/AuthAccess";
import { ClinicDisplay } from "./components/ClinicDisplay";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15000 } } });
function stripBase(path: string) { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path; }
export function Logo() { return <Link href="/" className="brand" data-testid="link-home"><span className="brand-mark"><Activity size={24}/></span>Clinic<span>Flow</span></Link>; }
function CacheReset() {
  const { addListener } = useClerk();
  const previous = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({user}) => { const id = user?.id ?? null; if (previous.current !== undefined && previous.current !== id) queryClient.clear(); previous.current = id; }), [addListener]);
  return null;
}
function Home() {
  const { isSignedIn } = useAuth();
  if (isSignedIn) return <AuthAccess><Redirect to="/onboarding"/></AuthAccess>;
  return <div className="landing">
    <header className="public-header"><Logo/><nav><a href="#how-it-works">How it works</a><a href="#for-clinics">For clinics</a><Link href="/patient-login">Patient login</Link><Link className="button small" href="/sign-in">Staff login <ArrowUpRight size={16}/></Link></nav></header>
    <main>
      <section className="hero"><div className="hero-copy"><span className="eyebrow"><span className="dot"/> BETTER CARE. LESS WAITING.</span><h1>A healthier way<br/>to manage<br/><em>your next visit.</em></h1><p>Find your clinic, book an appointment, and follow your place in line. A little less waiting. A lot more peace of mind.</p><div className="hero-actions"><Link className="button" href="/patient-login">Book an appointment <ArrowUpRight size={19}/></Link><Link className="text-link" href="/register-doctor">I'm a healthcare provider <ChevronRight size={17}/></Link></div><div className="trust"><ShieldCheck size={17}/> Secure sign-in <span/> Real-time queue updates <span/> Care on your terms</div></div>
      <div className="hero-art"><div className="art-grid"/><div className="art-heading"><span className="mini-mark"><Activity/></span><span>CONNECTED CARE<br/><strong>From booking to better.</strong></span></div><div className="care-orbit orbit-one"/><div className="care-orbit orbit-two"/><div className="care-center"><Stethoscope size={78} strokeWidth={1.25}/></div><div className="float-card card-a"><span className="icon-box"><CalendarDays/></span><div><strong>Your visit, simplified</strong><p>Appointments that fit your day</p></div></div><div className="float-card card-b"><span className="live-dot"/><div><strong>Stay in the know</strong><p>Follow your queue, wherever you are</p></div></div><div className="art-footer">Thoughtfully designed around you <ShieldCheck size={18}/></div></div></section>
      <section id="how-it-works" className="journey"><div><span className="eyebrow">CARE WITHOUT THE COMPLICATIONS</span><h2>Less admin. More living.</h2></div><div className="journey-grid">{[[Building2,"01","Find your care","Choose a clinic, location and doctor that work for you."],[CalendarDays,"02","Plan your visit","See actual availability and reserve your appointment."],[Clock3,"03","Skip the uncertainty","Check your token and live queue before you arrive."]].map(([Icon,n,title,body]: any)=><article key={n}><div className="journey-top"><Icon size={25}/><span>{n}</span></div><h3>{title}</h3><p>{body}</p></article>)}</div></section>
      <section id="for-clinics" className="provider-banner"><div><span className="eyebrow">FOR PEOPLE WHO CARE FOR PEOPLE</span><h2>Your practice. Working together.</h2><p>One workspace for your clinics, appointments, schedules and patient flow.</p></div><Link href="/register-doctor" className="button light">Join as a doctor <ArrowUpRight size={18}/></Link></section>
    </main><footer><Logo/><span>Thoughtful technology. Human care.</span><span>© {new Date().getFullYear()} ClinicFlow</span></footer>
  </div>;
}
function SignUpRoute() {
  const ticket = new URLSearchParams(window.location.search).get("__clerk_ticket") || new URLSearchParams(window.location.search).get("ticket");
  return <Redirect to={ticket ? `/set-password?__clerk_ticket=${encodeURIComponent(ticket)}` : "/patient-login"} />;
}
function RegisterDoctor(){
  useEffect(()=>{sessionStorage.setItem("clinicflow-intent","doctor");},[]);
  return (
    <div className="auth-layout">
      <aside>
        <Logo/>
        <div>
          <span className="eyebrow">PROVIDER ACCOUNT</span>
          <h1>Care begins with an invitation.</h1>
          <p>Healthcare providers cannot self-register directly. Please contact your clinic administrator to be invited to their workspace.</p>
        </div>
      </aside>
      <main style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '2rem', textAlign: 'center' }}>
        <h2>Already invited?</h2>
        <p className="muted" style={{ marginBottom: '2rem' }}>If your administrator has already set up your account, sign in to connect it.</p>
        <Link href="/sign-in" className="button">Staff login</Link>
        <div style={{ marginTop: '2rem' }}>
          <Link href="/" className="text-link">← Return to home</Link>
        </div>
      </main>
    </div>
  );
}
function Guard({role, page}: {role:string;page:string}) {
  const { isLoaded, isSignedIn } = useAuth();
  const me = api.useGetMe({query:{queryKey:api.getGetMeQueryKey(),enabled:!!isSignedIn,refetchOnWindowFocus:true,refetchInterval:60000}});
  if (!isLoaded || (isSignedIn && me.isLoading)) return <div className="page-loading">Preparing your workspace…</div>;
  if (!isSignedIn) return <Redirect to="/login"/>;
  if (me.error) return <div className="error-box">Unable to load your account: {me.error.message}<button onClick={()=>me.refetch()}>Try again</button></div>;
  if (!me.data?.user || me.data.needsOnboarding) return <Redirect to="/onboarding"/>;
  const actual = ["superAdmin","clinicAdmin"].includes(me.data.user.role) ? "admin" : me.data.user.role;
  if(actual !== role) return <Redirect to={`/${actual}/dashboard`}/>;
  if(me.data.user.role==="clinicAdmin"&&["masters","settings","audit"].includes(page)) return <Redirect to="/admin/dashboard"/>;
  return <Portal identity={me.data} role={role} page={page}/>;
}
function PublicBookingRoute({reference}: {reference:string}) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <div className="page-loading">Preparing booking…</div>;
  if (isSignedIn) return <AuthAccess><PublicBooking reference={reference}/></AuthAccess>;
  return <PublicBooking reference={reference}/>;
}
const routes: Record<string,string[]> = {
   admin:["dashboard","clinics","branches","users","patients","masters","appointments","queue","reports","settings","audit","qrs","book","availability","exceptions"],
  doctor:["dashboard","profile","clinics","branches","availability","exceptions","appointments","queue","patients","qrs","book","users"],
   receptionist:["dashboard","appointments","queue","patients","book","qrs","availability","exceptions"],
  patient:["dashboard","book","appointments","queue","profile"],
};
function Providers(){
 const [,setLocation]=useLocation();
 return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} routerPush={to=>setLocation(stripBase(to))} routerReplace={to=>setLocation(stripBase(to),{replace:true})}
 appearance={{options:{logoImageUrl:`${window.location.origin}${basePath}/logo.svg`,logoLinkUrl:basePath||"/"},variables:{colorPrimary:"#13786f",colorForeground:"#173332",colorMutedForeground:"#617471",colorBackground:"#ffffff",colorInput:"#ffffff",colorInputForeground:"#173332",colorDanger:"#b33636",fontFamily:"'DM Sans', sans-serif",borderRadius:"12px"},elements:{cardBox:{width:"420px",maxWidth:"100%",background:"#fff"},headerTitle:{color:"#173332"},headerSubtitle:{color:"#617471"},formFieldLabel:{color:"#173332"},footerActionLink:{color:"#13786f"}}}}
 localization={{signIn:{start:{title:"Welcome back",subtitle:"Sign in to your ClinicFlow workspace"}},signUp:{start:{title:"Your care, connected",subtitle:"Create your secure ClinicFlow account"}}}}>
  <QueryClientProvider client={queryClient}><CacheReset/><Switch><Route path="/" component={Home}/><Route path="/sign-in/*?" component={StaffLogin}/><Route path="/sign-up/*?" component={SignUpRoute}/><Route path="/patient-login" component={PatientLogin}/><Route path="/forgot-password" component={ForgotPassword}/><Route path="/set-password" component={SetPassword}/><Route path="/login"><Redirect to="/sign-in"/></Route><Route path="/register"><Redirect to="/patient-login"/></Route><Route path="/register-doctor" component={RegisterDoctor}/><Route path="/onboarding"><AuthAccess><Onboarding/></AuthAccess></Route><Route path="/check-in" component={CheckInScanner}/><Route path="/admin/doctors"><Redirect to="/admin/users?tab=doctors"/></Route><Route path="/display/:reference">{p=><ClinicDisplay reference={p.reference}/>}</Route><Route path="/book/:reference">{p=><PublicBookingRoute reference={p.reference}/>}</Route>{Object.entries(routes).flatMap(([role,pages])=>[<Route key={role} path={`/${role}`}><AuthAccess><Redirect to={`/${role}/dashboard`}/></AuthAccess></Route>,...pages.map(page=><Route key={`${role}/${page}`} path={`/${role}/${page}`}><AuthAccess><Guard role={role} page={page}/></AuthAccess></Route>)])}<Route><div className="empty"><h1>Page not found</h1><Link href="/">Return home</Link></div></Route></Switch></QueryClientProvider></ClerkProvider>;
}
export default function App(){ return <Router base={basePath}><Providers/></Router>; }