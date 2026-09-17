import { useCallback, useEffect, useState } from "react";
import { Archive, Bell, Inbox, MessageSquare, MoreVertical, Plus, RotateCcw, Settings, Trash2 } from "lucide-react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Button } from "../../components/ui/Button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../components/ui/Dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../components/ui/DropdownMenu";
import { Input } from "../../components/ui/Input";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuIcon,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "../../components/ui/sidebar";
import { fetchWithCsrf } from "../../lib/api";
import { UserMenu } from "../auth/UserMenu";

type Session = { sessionId: string; title?: string | null; type?: string; status?: string; is_paused?: number };
type SessionAction = { session: Session; action: "archive" | "restore" | "reset" | "delete" };

const primaryNavigation = [
  { to: "/mail", label: "Mail", icon: Inbox },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function SessionSidebar() {
  const { setOpenMobile } = useSidebar();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<SessionAction | null>(null);
  const pathname = useRouterState({ select: state => state.location.pathname });
  const navigate = useNavigate();

  const loadSessions = useCallback(async () => {
    const response = await fetchWithCsrf("/api/sessions");
    if (response.ok) setSessions((await response.json()).sessions);
  }, []);
  useEffect(() => { void loadSessions(); }, [loadSessions]);

  const runAction = async () => {
    if (!pendingAction) return;
    const { session, action } = pendingAction;
    const method = action === "delete" ? "DELETE" : action === "reset" ? "POST" : "PUT";
    const suffix = action === "delete" ? "" : `/${action}`;
    const response = await fetchWithCsrf(`/api/sessions/${encodeURIComponent(session.sessionId)}${suffix}`, { method });
    if (response.ok) {
      if (action === "delete" && pathname === `/chat/${session.sessionId}`) {
        await navigate({ to: "/chat/$sessionId", params: { sessionId: "main" } });
      }
      await loadSessions();
      setPendingAction(null);
    }
  };

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild size="lg" tooltip="Lali" className="text-crimson10">
                <Link to="/" onClick={() => setOpenMobile(false)}>
                  <SidebarMenuIcon layout="position" className="flex size-8 shrink-0 rotate-3 items-center justify-center rounded-lg border border-crimson7 bg-crimson4 text-sm font-black shadow-2">L</SidebarMenuIcon>
                  <SidebarLabel className="text-xl font-bold tracking-tight">Lali</SidebarLabel>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup className="pb-1">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton variant="outline" tooltip="New chat" onClick={() => setCreateOpen(true)}>
                    <SidebarMenuIcon layout="position" className="flex shrink-0"><Plus /></SidebarMenuIcon>
                    <SidebarLabel>New chat</SidebarLabel>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup className="py-1">
            <SidebarGroupContent>
              <SidebarMenu>
                {primaryNavigation.map(item => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={pathname === item.to} tooltip={item.label}>
                        <Link to={item.to} onClick={() => setOpenMobile(false)}>
                          <SidebarMenuIcon layout="position" className="flex shrink-0"><Icon /></SidebarMenuIcon>
                          <SidebarLabel>{item.label}</SidebarLabel>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          <SidebarGroup>
            <SidebarGroupLabel>Chats</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {sessions.map(session => {
                  const active = pathname === `/chat/${session.sessionId}`;
                  const archived = session.status === "archived";
                  const title = session.title || session.sessionId;
                  return (
                    <SidebarMenuItem key={session.sessionId}>
                      <SidebarMenuButton asChild isActive={active} tooltip={title} className={archived ? "text-slate9" : undefined}>
                        <Link to="/chat/$sessionId" params={{ sessionId: session.sessionId }} onClick={() => setOpenMobile(false)}>
                          <SidebarMenuIcon layout="position" className="flex shrink-0"><MessageSquare /></SidebarMenuIcon>
                          <SidebarLabel>{title}</SidebarLabel>
                        </Link>
                      </SidebarMenuButton>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <SidebarMenuAction showOnHover aria-label={`Actions for ${title}`}>
                            <MoreVertical />
                          </SidebarMenuAction>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="right" align="start">
                          <DropdownMenuItem onSelect={() => setPendingAction({ session, action: archived ? "restore" : "archive" })}>
                            {archived ? <RotateCcw size={15} /> : <Archive size={15} />}
                            {archived ? "Restore" : "Archive"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setPendingAction({ session, action: "reset" })}><RotateCcw size={15} />Reset</DropdownMenuItem>
                          {session.sessionId !== "main" && (
                            <DropdownMenuItem className="text-red11" onSelect={() => setPendingAction({ session, action: "delete" })}><Trash2 size={15} />Delete</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarSeparator />
        <SidebarFooter><UserMenu /></SidebarFooter>
      </Sidebar>

      <CreateSessionDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={loadSessions} />
      <Dialog open={pendingAction !== null} onOpenChange={open => !open && setPendingAction(null)}>
        <DialogContent>
          <DialogTitle className="capitalize">{pendingAction?.action} session?</DialogTitle>
          <DialogDescription>{pendingAction?.action === "delete" ? "This permanently deletes the session and its history." : `This will ${pendingAction?.action} "${pendingAction?.session.title || pendingAction?.session.sessionId}".`}</DialogDescription>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setPendingAction(null)}>Cancel</Button><Button variant={pendingAction?.action === "delete" ? "destructive" : "primary"} onClick={() => void runAction()}>Continue</Button></div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CreateSessionDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [workspaceName, setWorkspaceName] = useState("assistant");
  const [subPath, setSubPath] = useState("");
  const navigate = useNavigate();
  const createSession = async () => {
    const sessionId = crypto.randomUUID();
    const response = await fetchWithCsrf("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, title: title.trim() || "New chat", workspaceName: workspaceName.trim(), subPath: subPath.trim() || undefined }) });
    if (!response.ok) return;
    await onCreated();
    onOpenChange(false);
    await navigate({ to: "/chat/$sessionId", params: { sessionId } });
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogTitle>Create new chat</DialogTitle><DialogDescription>Choose the configured workspace for this session.</DialogDescription><div className="space-y-3"><label className="block text-sm text-slate11">Title<Input value={title} onChange={event => setTitle(event.target.value)} placeholder="New chat" /></label><label className="block text-sm text-slate11">Workspace<Input required value={workspaceName} onChange={event => setWorkspaceName(event.target.value)} /></label><label className="block text-sm text-slate11">Subpath <span className="text-slate9">(optional)</span><Input value={subPath} onChange={event => setSubPath(event.target.value)} /></label></div><div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" disabled={!workspaceName.trim()} onClick={() => void createSession()}>Create</Button></div></DialogContent></Dialog>;
}
