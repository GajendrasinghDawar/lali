import { useState, useEffect, useRef } from "react";

import { useNavigate } from "@tanstack/react-router";
import { initCsrfToken } from "../../lib/api";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("/api/auth/get-session")
      .then(res => res.json())
      .then(data => {
        if (data && data.session) {
          initCsrfToken().then(() => setIsAuthenticated(true));
        } else {
          setIsAuthenticated(false);
          navigate({ to: "/login" });
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
        navigate({ to: "/login" });
      });
  }, [navigate]);

  if (isAuthenticated === null) return <div className="flex min-h-svh items-center justify-center bg-slate2 text-sm text-slate10">Loading Lali...</div>;
  if (!isAuthenticated) return null;

  return <>{children}</>;
}
