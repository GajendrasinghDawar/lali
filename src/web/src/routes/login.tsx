import { useState } from "react";
import { LogIn, Sparkles } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "../components/ui/Button";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const loginGitHub = async () => {
    setError(null); setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/sign-in/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: "github", callbackURL: `${window.location.origin}/` }) });
      const data: unknown = await response.json();
      if (!response.ok || !data || typeof data !== "object" || !("url" in data) || typeof data.url !== "string") throw new Error("Unable to start GitHub sign-in");
      window.location.href = data.url;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to start sign-in"); setIsSubmitting(false); }
  };
  return <main className="flex min-h-svh items-center justify-center bg-slate2 p-4"><section className="w-full max-w-sm rounded-xl border border-slate5 bg-slate3 p-7 shadow-5"><div className="mb-6 flex size-10 rotate-3 items-center justify-center rounded-lg border border-crimson7 bg-crimson4 text-crimson11 shadow-2"><Sparkles size={19} /></div><h1 className="text-2xl font-bold text-slate12">Sign in to Lali</h1><p className="mt-2 text-sm leading-relaxed text-slate10">Access your sessions, mail, and assistant workspace.</p><Button className="mt-6 w-full" variant="primary" disabled={isSubmitting} onClick={() => void loginGitHub()}><LogIn size={17} />{isSubmitting ? "Redirecting..." : "Continue with GitHub"}</Button>{error && <p role="alert" className="mt-4 rounded-md border border-red7 bg-red3 p-3 text-sm text-red11">{error}</p>}</section></main>;
}
