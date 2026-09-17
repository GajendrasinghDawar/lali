import { useEffect, useState } from "react";
import { ChevronsUpDown, LogOut, Settings } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/Avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../../components/ui/DropdownMenu";
import { SidebarLabel, SidebarMenuButton, SidebarMenuIcon } from "../../components/ui/sidebar";

type AuthUser = { name: string; email: string; image?: string | null };

export function UserMenu() {
  const [user, setUser] = useState<AuthUser | null>(null);
  useEffect(() => { void fetch("/api/auth/get-session").then(response => response.json()).then(data => setUser(data.user ?? null)); }, []);

  const logout = async () => {
    const response = await fetch("/api/auth/sign-out", { method: "POST" });
    if (response.ok) window.location.href = "/login";
  };

  if (!user) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton size="lg" tooltip={user.name} className="border border-slate5 bg-slate3 hover:bg-slate4">
          <SidebarMenuIcon layout="position" className="flex shrink-0"><Avatar>{user.image && <AvatarImage src={user.image} alt="" />}<AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback></Avatar></SidebarMenuIcon>
          <SidebarLabel className="flex flex-1 items-center gap-2">
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate12">{user.name}</span><span className="block truncate text-xs text-slate10">{user.email}</span></span>
            <ChevronsUpDown className="size-4 shrink-0 text-slate9" />
          </SidebarLabel>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="min-w-56">
        <DropdownMenuLabel className="max-w-52 truncate px-2 py-1.5 text-xs text-slate10">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link to="/settings"><Settings size={15} />Settings</Link></DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void logout()}><LogOut size={15} />Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
