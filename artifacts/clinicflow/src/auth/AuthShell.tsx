import type { ReactNode } from "react";
import { Link } from "wouter";
import { ShieldCheck } from "lucide-react";
import { Logo } from "../App";

export function AuthShell({ children, eyebrow = "WELCOME TO CLINICFLOW", registration = false }: { children: ReactNode; eyebrow?: string; registration?: boolean }) {
  return (
    <div className={`auth-layout${registration ? " registration-auth-layout" : ""}`}>
      <aside>
        <Logo />
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>Good care starts<br />with a connection.</h1>
          <p className="auth-general-intro">Your appointments, your care team, and a clearer path to your next visit.</p>
          {registration && <div className="registration-desktop-intro">
            <h2>Start with your secure account.</h2>
            <p>Create an account with a verified email and password. Then we’ll guide you through your clinic, locations and opening hours.</p>
          </div>}
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

export function AuthCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="auth-card">
      <h1>{title}</h1>
      <p className="auth-description">{description}</p>
      {children}
    </section>
  );
}