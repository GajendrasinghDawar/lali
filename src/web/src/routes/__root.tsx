import { createRootRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AuthGate } from "../features/auth/AuthGate";
import { AppShell } from "../app/AppShell";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const routerState = useRouterState();
  const isLogin = routerState.location.pathname === "/login";

  return (
    <>
      {isLogin ? <Outlet /> : (
        <AuthGate>
          <AppShell />
        </AuthGate>
      )}
    </>
  );
}
