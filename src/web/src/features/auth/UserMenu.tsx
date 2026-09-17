import { useEffect, useState } from "react";
import { LogOut, Settings } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/Avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../../components/ui/DropdownMenu";

type AuthUser = { name: string; email: string; image?: string | null };

export function UserMenu({ collapsed }: { collapsed: boolean }) {
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
        <button className="flex w-full items-center gap-2 rounded-lg border border-slate5 bg-slate3 p-2 text-left hover:bg-slate4">
          <Avatar>{user.image && <AvatarImage src={user.image} alt="" />}<AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
          {!collapsed && <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-slate12">{user.name}</div><div className="truncate text-xs text-slate10">{user.email}</div></div>}
        </button>
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
