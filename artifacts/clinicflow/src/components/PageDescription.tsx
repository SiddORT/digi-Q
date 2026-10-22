import { Info } from "lucide-react";
import { HelpTip } from "./HelpTip";
import "./page-description.css";

/** Optional instructions belong to one adjacent trigger, never to the text or enclosing link. */
export function PageDescription({ text, help, label = "More information", className = "" }: {
  text: string; help?: string; label?: string; className?: string;
}) {
  return <p className={`page-description ${className}`}>{text}{help && <> <HelpTip
    label={label} text={help} icon={<Info size={15} aria-hidden="true" />}
  /></>}</p>;
}
