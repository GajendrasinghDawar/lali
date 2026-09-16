import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const loginGitHub = async () => {
    const res = await fetch("/api/auth/sign-in/social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "github", callbackURL: window.location.origin + "/" })
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

  return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center" }}>
      <div style={{ padding: "2rem", border: "1px solid var(--color-border)", borderRadius: "0.5rem" }}>
        <h2>Sign in to Lali</h2>
        <button onClick={loginGitHub} style={{ padding: "0.5rem 1rem", cursor: "pointer" }}>
          Sign in with GitHub
        </button>
      </div>
    </div>
  );
}
