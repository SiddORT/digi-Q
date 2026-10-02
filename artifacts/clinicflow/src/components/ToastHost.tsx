import { Toaster as Sonner } from "sonner";

/** The single app-wide toast host (sonner). Mounted once in App.tsx. Uses current central colors only. */
export function ToastHost() {
  return (
    <Sonner
      theme="light"
      position="top-right"
      closeButton
      visibleToasts={3}
      containerAriaLabel="Notifications"
      toastOptions={{
        classNames: {
          toast: "app-toast",
          title: "app-toast-title",
          description: "app-toast-desc",
          closeButton: "app-toast-close",
        },
      }}
    />
  );
}
