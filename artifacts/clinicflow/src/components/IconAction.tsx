import type { ReactNode } from "react";
import { Link } from "wouter";
import { HelpTip } from "./HelpTip";

/** Shared compact icon action (Details, Edit, More, Download, Print...).
 *  The accessible name is always the full label; the same label appears as a hover/focus tooltip.
 *  Disabled actions keep a focusable wrapper so the reason stays readable by keyboard and pointer. */
export function IconAction({ label, icon, onClick, href, disabled, disabledReason, testId, tone, className, hint }: {
  label: string; icon: ReactNode; onClick?: () => void; href?: string; disabled?: boolean; disabledReason?: string;
  testId?: string; tone?: "danger"; className?: string; hint?: string;
}) {
  const tip = disabled && disabledReason ? `${hint || label}. ${disabledReason}` : hint || label;
  const cls = ["icon-action", tone === "danger" ? "danger" : "", className].filter(Boolean).join(" ");
  if (href && !disabled) return <HelpTip text={tip}><Link href={href} className={cls} aria-label={label} data-testid={testId}>{icon}</Link></HelpTip>;
  return <HelpTip text={tip}><button type="button" className={cls} aria-label={label} disabled={disabled} onClick={onClick} data-testid={testId}>{icon}</button></HelpTip>;
}
