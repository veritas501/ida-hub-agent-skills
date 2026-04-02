import { useEffect, useState } from "react";
import { isAuthenticated } from "@/lib/auth";

interface AuthGuardProps { children: React.ReactNode; fallback?: React.ReactNode; }

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!isAuthenticated()) { window.location.href = "/login"; return; }
    setMounted(true);
  }, []);
  if (!mounted) return fallback ?? null;
  return <>{children}</>;
}
