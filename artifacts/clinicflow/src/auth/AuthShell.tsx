import type { ReactNode } from "react";
import { Link } from "wouter";
import { ShieldCheck } from "lucide-react";
import { Logo } from "../App";
import { BRAND_NAME } from "../branding";
import { PageDescription } from "../components/PageDescription";

export function AuthShell({ children, eyebrow = `WELCOME TO ${BRAND_NAME.toUpperCase()}`, registration = false }: { children: ReactNode; eyebrow?: string; registration?: boolean }) {
  return (
    <div className={`auth-layout${registration ? " registration-auth-layout" : ""}`}>
      <aside>
        <Logo />
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>Good Care Starts<br />with a connection.</h1>
          <ShieldCheck size={36} />
        </div>
        <small>Secure identity. Personal care.</small>
      </aside>
      <main>
        <Link href="/" className="back-link" data-testid="link-auth-home">← Back to home</Link>
        {children}
      </main>
    </div>
  );
}

export function AuthCard({ title, description, help, children }: { title: string; description: string; help?: string; children: ReactNode }) {
  return (
    <section className="auth-card">
      <h1>{title}</h1>
      <PageDescription className="auth-description" text={description} help={help} label={`About ${title.toLowerCase()}`}/>
      {children}
    </section>
  );
}