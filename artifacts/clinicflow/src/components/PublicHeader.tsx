import { useEffect, useId, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Menu } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { AppDialog } from "./AppDialog";
import "./public-header.css";

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1101px)");
    const closeOnWide = () => { if (wide.matches) setOpen(false); };
    wide.addEventListener("change", closeOnWide);
    return () => wide.removeEventListener("change", closeOnWide);
  }, []);
  const links = <>
    <a href="#how-it-works" onClick={() => setOpen(false)}>How It Works</a>
    <a href="#for-clinics" onClick={() => setOpen(false)}>For Clinics</a>
    <Link href="/register-clinic" onClick={() => setOpen(false)} data-testid="landing-register-clinic">Register a Clinic</Link>
    <Link href="/guest-booking" onClick={() => setOpen(false)} data-testid="landing-guest-booking">Guest Booking</Link>
    <Link href="/patient-login" onClick={() => setOpen(false)}>Patient Login</Link>
    <Link className="button public-primary" href="/sign-in" onClick={() => setOpen(false)}>Staff Login <ArrowUpRight size={19} aria-hidden/></Link>
  </>;
  return <header className="public-header unified-public-header">
    <BrandLogo/>
    <nav className="public-desktop-nav" aria-label="Main Navigation">{links}</nav>
    <button type="button" className="public-menu-toggle" aria-label="Open Navigation" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => setOpen(true)}><Menu size={22} aria-hidden/></button>
    <AppDialog open={open} onClose={() => setOpen(false)} title="Navigation" variant="drawer">
      <nav id={menuId} className="public-drawer-nav" aria-label="Main Navigation">{links}</nav>
    </AppDialog>
  </header>;
}
