import type { ReactNode } from "react";
import { Link } from "wouter";
import { ShieldCheck } from "lucide-react";
import { Logo } from "../App";

export function AuthShell({ children, eyebrow = "WELCOME TO CLINICFLOW" }: { children: ReactNode; eyebrow?: string }) {
  return (
    <div className="auth-layout">
      <aside>
        <Logo />
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>Good care starts<br />with a connection.</h1>
          <p>Your appointments, your care team, and a clearer path to your next visit.</p>
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