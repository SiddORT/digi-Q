import { useEffect, useState } from "react";

export function useFreshWorkspace(updatedAt: number, failed = false) {
  const [now, setNow] = useState(Date.now());
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => { setOnline(navigator.onLine); setNow(Date.now()); };
    const interval = window.setInterval(update, 10000);
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { clearInterval(interval); window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  return { online, stale: !online || failed || !updatedAt || now - updatedAt > 90000 };
}