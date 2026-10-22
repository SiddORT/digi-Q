import { Children, isValidElement, type ReactNode } from "react";
import { ResourceLookup, ResourceMultiLookup, ResourceLookupReadiness } from "./ResourceLookup";
import { CareLookup, CareLookupReadiness } from "./CareLookup";

/** Inspect declared controls, not arbitrary component implementations. This mounts
 * query observers only: no hidden inputs, focus targets, defaults or draft effects.
 * The same observers and exact actor/scope keys are used when the UI opens. */
export function LookupReadiness({ children }: { children: ReactNode }) {
  return <>{Children.map(children, child => {
    if (!isValidElement(child)) return null;
    const props = child.props as any;
    if (child.type === ResourceLookup || child.type === ResourceMultiLookup)
      return <ResourceLookupReadiness {...props}/>;
    if (child.type === CareLookup) return <CareLookupReadiness {...props}/>;
    return props.children ? <LookupReadiness>{props.children}</LookupReadiness> : null;
  })}</>;
}
