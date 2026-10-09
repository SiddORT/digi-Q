import { Children, isValidElement, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Eye, LogIn, Mail, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";

function hasIcon(node: ReactNode): boolean {
  return Children.toArray(node).some(child => {
    if (!isValidElement<{ children?: ReactNode; size?: number }>(child)) return false;
    return child.type === "svg" || (typeof child.type !== "string" && (
      child.props.size !== undefined || (typeof child.type === "object" && typeof (child.type as { displayName?: string }).displayName === "string")
    )) || hasIcon(child.props.children);
  });
}
function labelText(node: ReactNode): string {
  return Children.toArray(node).map(child => typeof child === "string" ? child : isValidElement<{children?: ReactNode}>(child) ? labelText(child.props.children) : "").join(" ");
}
/** Shared CTA content; keep consumer-supplied icons, otherwise add one meaningful leading icon. */
export function ActionLabel({ children }: { children: ReactNode }) {
  const text = labelText(children).toLowerCase();
  const Icon = /discard|delete|remove/.test(text) ? Trash2 : /back/.test(text) ? ArrowLeft : /cancel|close/.test(text) ? X :
    /resend|reset|retry|again/.test(text) ? RotateCcw : /email|code|invitation|send/.test(text) ? Mail : /review|view/.test(text) ? Eye :
    /finish|verify|confirm/.test(text) ? Check : /continue|next/.test(text) ? ArrowRight : /add|create/.test(text) ? Plus :
    /sign in|workspace/.test(text) ? LogIn : Save;
  return <>{!hasIcon(children) && <Icon size={17} aria-hidden="true"/>}{children}</>;
}
