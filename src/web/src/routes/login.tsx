import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loginGitHub = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/sign-in/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "github", callbackURL: window.location.origin + "/" })
      });
      const responseText = await res.text();
      let data: unknown = null;
      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          if (!res.ok) {
            throw new Error(`Sign-in failed with status ${res.status}`);
          }
          throw new Error("The sign-in response was not valid JSON");
        }
      }

      if (!res.ok) {
        throw new Error(`Sign-in failed with status ${res.status}`);
      }

      if (
        !data ||
        typeof data !== "object" ||
        !("url" in data) ||
        typeof data.url !== "string"
      ) {
        throw new Error("The sign-in response did not include a redirect URL");
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start sign-in");
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center" }}>
      <div style={{ padding: "2rem", border: "1px solid var(--color-border)", borderRadius: "0.5rem" }}>
        <h2>Sign in to Lali</h2>
        <button
          disabled={isSubmitting}
          onClick={loginGitHub}
          style={{ padding: "0.5rem 1rem", cursor: isSubmitting ? "wait" : "pointer" }}
        >
          {isSubmitting ? "Redirecting..." : "Sign in with GitHub"}
        </button>
        {error && <p role="alert" style={{ color: "var(--color-danger)" }}>{error}</p>}
      </div>
    </div>
  );
}
