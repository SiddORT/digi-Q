import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route, Switch, Redirect, Link, useLocation } from "wouter";
import { Activity, ArrowUpRight, CalendarDays, ShieldCheck, Clock3, Building2, Stethoscope, ChevronRight, QrCode } from "lucide-react";
import { BRAND_NAME } from "./branding";
import "./lib/api";
import { NativeAuthProvider, useNativeAuth } from "./auth/native-auth";
import { BrandLogo } from "./components/BrandLogo";
import * as api from "@workspace/api-client-react";
import { Portal, Onboarding, PublicBooking } from "./clinic";
import { CheckInScanner } from "./CheckIn";
import { StaffLogin } from "./auth/StaffLogin";
import { PatientLogin } from "./auth/PatientLogin";
import { ForgotPassword, SetPassword } from "./auth/PasswordFlows";
import { AuthAccess } from "./auth/AuthAccess";
import { ClinicDisplay } from "./components/ClinicDisplay";
import { ClinicRegistration } from "./components/ClinicRegistration";
import { PublicClinicPage } from "./components/PublicClinicPage";
import { PatientScanner } from "./components/PatientScanner";
import { GuestClinicFinder } from "./components/GuestClinicFinder";
import { DemoLogin } from "./auth/DemoLogin";
import { AuthShell, AuthCard } from "./auth/AuthShell";
import { ToastHost } from "./components/ToastHost";
import { friendlyError } from "./lib/friendly-error";
import { PublicHeader } from "./components/PublicHeader";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15000 } } });
export { BrandLogo as Logo };
const Logo = BrandLogo;
function Home() {
  const { isSignedIn } = useNativeAuth();
  if (isSignedIn) return <AuthAccess><Redirect to="/onboarding"/></AuthAccess>;
  return <div className="landing">
    <PublicHeader/>
    <main>
      <section className="hero"><div className="hero-copy"><span className="eyebrow"><span className="dot"/> Better Care. Less Waiting.</span><h1>A Healthier Way to Manage <em>Your Next Visit.</em></h1><p>Find your clinic, book an appointment, and follow your place in line. A little less waiting. A lot more peace of mind.</p><div className="hero-actions"><Link className="button public-primary" href="/scan-qr" data-testid="landing-scan-qr"><QrCode size={19} aria-hidden/> Scan QR Code</Link><Link className="button secondary" href="/guest-booking" data-testid="landing-book-guest">Guest Booking <ArrowUpRight size={19}/></Link><Link className="text-link" href="/register-doctor">I'm a Healthcare Provider <ChevronRight size={17}/></Link></div><div className="trust"><ShieldCheck size={17}/> No login needed to request a visit <span/> Real-Time Queue Updates</div></div>
      <div className="hero-art"><div className="art-grid"/><div className="art-heading"><span className="mini-mark"><Activity/></span><span>Connected Care<br/><strong>From Booking to Better</strong></span></div><div className="care-orbit orbit-one"/><div className="care-orbit orbit-two"/><div className="care-center"><Stethoscope size={78} strokeWidth={1.25}/></div><div className="float-card card-a"><span className="icon-box"><CalendarDays/></span><div><strong>Your Visit, Simplified</strong><p>Appointments That Fit Your Day</p></div></div><div className="float-card card-b"><span className="live-dot"/><div><strong>Stay in the Know</strong><p>Follow Your Queue, Wherever You Are</p></div></div><div className="art-footer">Thoughtfully Designed Around You <ShieldCheck size={18}/></div></div></section>
      <section id="how-it-works" className="journey"><div><span className="eyebrow">Care Without the Complications</span><h2>Less Admin. More Living.</h2></div><div className="journey-grid">{[[Building2,"01","Find Your Care","Choose a clinic, location and doctor that work for you."],[CalendarDays,"02","Plan Your Visit","See actual availability and reserve your appointment."],[Clock3,"03","Skip the Uncertainty","Check your token and live queue before you arrive."]].map(([Icon,n,title,body]: any)=><article key={n}><div className="journey-top"><Icon size={25}/><span>{n}</span></div><h3>{title}</h3><p>{body}</p></article>)}</div></section>
      <section id="for-clinics" className="provider-banner"><div><span className="eyebrow">For People Who Care for People</span><h2>Your Practice. Working Together.</h2><p>One workspace for your clinics, appointments, schedules and patient flow.</p></div><Link href="/register-clinic" className="button light" data-testid="landing-register-clinic-banner">Register a Clinic <ArrowUpRight size={18}/></Link></section>
    </main><footer><Logo compact/><span>Thoughtful Technology. Human Care.</span><span>© {new Date().getFullYear()} {BRAND_NAME}</span></footer>
  </div>;
}
function SignUpRoute() {
  const ticket = new URLSearchParams(window.location.search).get("ticket");
  return <Redirect to={ticket ? `/set-password?token=${encodeURIComponent(ticket)}` : "/patient-login"} />;
}
function ResetPasswordRoute() {
  const token = new URLSearchParams(window.location.search).get("token");
  return <Redirect to={token ? `/set-password?flow=reset&token=${encodeURIComponent(token)}` : "/forgot-password"} />;
}
function RegisterDoctor(){
  useEffect(()=>{sessionStorage.setItem("clinicflow-intent","doctor");},[]);
  return (
    <AuthShell eyebrow="Provider Account">
      <AuthCard title="Already invited?" description="Healthcare providers cannot self-register. Ask your clinic administrator to invite you; if your account is already set up, sign in to connect it.">
        <Link href="/sign-in" className="button" data-testid="link-register-doctor-sign-in">Staff Login</Link>
      </AuthCard>
    </AuthShell>
  );
}
function Guard({role, page}: {role:string;page:string}) {
  const { isLoaded, isSignedIn } = useNativeAuth();
  const me = api.useGetMe({query:{queryKey:api.getGetMeQueryKey(),enabled:!!isSignedIn,refetchOnWindowFocus:true,refetchInterval:60000}});
  if (!isLoaded || (isSignedIn && me.isLoading)) return <div className="page-loading">Preparing your workspace…</div>;
  if (!isSignedIn) return <Redirect to="/login"/>;
  if (me.error) return <div className="error-box" role="alert">Unable to load your account. {friendlyError(me.error,"load")}<button onClick={()=>me.refetch()}>Try Again</button></div>;
  if (!me.data?.user || me.data.needsOnboarding) return <Redirect to="/onboarding"/>;
  const actual = ["superAdmin","clinicAdmin"].includes(me.data.user.role) ? "admin" : me.data.user.role;
  if(actual !== role) return <Redirect to={`/${actual}/dashboard`}/>;
  if(me.data.user.role==="clinicAdmin"&&["masters","audit","demo","integrations","permissions","system-users"].includes(page)) return <Redirect to="/admin/dashboard"/>;
  if(role==="admin"&&page==="profile"&&(me.data.user.role!=="clinicAdmin"||!me.data.doctorId)) return <Redirect to="/admin/dashboard"/>;
  return <Portal identity={me.data} role={role} page={page}/>;
}
function PublicBookingRoute({reference}: {reference:string}) {
  const { isLoaded, isSignedIn } = useNativeAuth();
  if (!isLoaded) return <div className="page-loading">Preparing booking…</div>;
  if (isSignedIn) return <AuthAccess><PublicBooking reference={reference}/></AuthAccess>;
  return <PublicBooking reference={reference}/>;
}
const routes: Record<string,string[]> = {
   admin:["dashboard","clinics","branches","users","patients","masters","appointments","queue","reports","settings","audit","qrs","book","availability","exceptions","profile","demo","templates","permissions","integrations","system-users"],
  doctor:["dashboard","profile","clinics","branches","availability","exceptions","appointments","queue","patients","qrs","book","users"],
   receptionist:["dashboard","appointments","queue","patients","book","qrs","availability","exceptions"],
  patient:["dashboard","book","appointments","queue","profile"],
};
function Providers(){
  return <QueryClientProvider client={queryClient}><NativeAuthProvider><Switch>
    <Route path="/" component={Home}/>
    <Route path="/sign-in/*?" component={StaffLogin}/>
    <Route path="/sign-up/*?" component={SignUpRoute}/>
    <Route path="/register-clinic/*?" component={ClinicRegistration}/>
    <Route path="/patient-login" component={PatientLogin}/>
    <Route path="/demo-login" component={DemoLogin}/>
    <Route path="/scan-qr" component={PatientScanner}/>
    <Route path="/guest-booking" component={GuestClinicFinder}/>
    <Route path="/forgot-password" component={ForgotPassword}/>
     <Route path="/reset-password" component={ResetPasswordRoute}/>
    <Route path="/set-password" component={SetPassword}/>
    <Route path="/login"><Redirect to="/sign-in"/></Route>
    <Route path="/register"><Redirect to="/patient-login"/></Route>
    <Route path="/register-doctor" component={RegisterDoctor}/>
    <Route path="/onboarding"><AuthAccess><Onboarding/></AuthAccess></Route>
    <Route path="/check-in" component={CheckInScanner}/>
    <Route path="/admin/doctors"><Redirect to="/admin/users?tab=doctors"/></Route>
    <Route path="/display/:reference">{p=><ClinicDisplay reference={p.reference}/>}</Route>
    <Route path="/book/:reference">{p=><PublicBookingRoute reference={p.reference}/>}</Route>
    {Object.entries(routes).flatMap(([role,pages])=>[<Route key={role} path={`/${role}`}><AuthAccess><Redirect to={`/${role}/dashboard`}/></AuthAccess></Route>,...pages.map(page=><Route key={`${role}/${page}`} path={`/${role}/${page}`}><AuthAccess><Guard role={role} page={page}/></AuthAccess></Route>)])}
    <Route path="/:clinicSlug/:branchSlug">{p=><PublicClinicPage clinicSlug={p.clinicSlug} branchSlug={p.branchSlug}/>}</Route>
    <Route path="/:clinicSlug">{p=><PublicClinicPage clinicSlug={p.clinicSlug}/>}</Route>
    <Route><div className="empty"><h1>Page Not Found</h1><Link href="/">Return Home</Link></div></Route>
   </Switch><ToastHost/></NativeAuthProvider></QueryClientProvider>;
}
export default function App(){ return <Router base={basePath}><Providers/></Router>; }