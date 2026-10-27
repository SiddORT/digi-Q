import { createRoot } from "react-dom/client";
import App from "../src/App";
import { ErrorBoundary } from "../src/components/error-boundary";
import "./appointment-details.css";

// Same app and global stylesheet order as main.tsx. The fixture's separate Vite
// root needs the explicit @source in appointment-details.css for lazy dialogs,
// menus and other source utilities, not just already-imported component classes.
createRoot(document.getElementById("root")!, {
  onCaughtError: (error, info) => console.error(error, info.componentStack),
}).render(<ErrorBoundary><App /></ErrorBoundary>);
