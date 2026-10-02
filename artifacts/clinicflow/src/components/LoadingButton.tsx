import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import "./shared-feedback.css";

export interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  /** Text while loading, e.g. "Saving…". Defaults to children. */
  loadingText?: string;
}

/** Stable-width button with spinner that blocks double submit (spec §7.10). */
export const LoadingButton = forwardRef<HTMLButtonElement, LoadingButtonProps>(function LoadingButton(
  { loading = false, loadingText, disabled, children, className, onClick, ...props }, ref,
) {
  return (
    <button ref={ref} {...props} className={["loading-button", className].filter(Boolean).join(" ")}
      disabled={disabled || loading} aria-busy={loading || undefined}
      onClick={(e) => { if (loading) { e.preventDefault(); return; } onClick?.(e); }}>
      {loading && <Loader2 className="loading-button-spin h-4 w-4" aria-hidden="true" />}
      <span>{loading && loadingText ? loadingText : children}</span>
    </button>
  );
});
