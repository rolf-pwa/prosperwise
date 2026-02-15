import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth";
import { LayoutDashboard, Users, LogOut, Shield, Folder, CheckSquare, ShieldCheck, ExternalLink, Calendar, Mail, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/contacts", label: "Contacts", icon: Users },
];

const externalLinks = [
  { href: "https://prosperwise.sidedrawer.com", label: "SideDrawer", icon: Folder },
  { href: "https://app.asana.com", label: "Asana", icon: CheckSquare },
  { href: "https://iaa.secureweb.inalco.com/MKMWPN23/home", label: "IA Financial", icon: ShieldCheck },
  { href: "https://calendar.google.com", label: "Google Calendar", icon: Calendar },
  { href: "https://mail.google.com", label: "Gmail", icon: Mail },
  { href: "https://drive.google.com", label: "Google Drive", icon: FolderOpen },
];

export function AppSidebar() {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary/20">
          <Shield className="h-5 w-5 text-sidebar-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-sidebar-foreground">Sovereignty</h2>
          <p className="text-xs text-sidebar-foreground/50">CRM</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              location.pathname === to || location.pathname.startsWith(to + "/")
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}

        <Separator className="my-3 bg-sidebar-border" />

        <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
          Integrations
        </p>
        {externalLinks.map(({ href, label, icon: Icon }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <Icon className="h-4 w-4" />
            {label}
            <ExternalLink className="ml-auto h-3 w-3 opacity-40" />
          </a>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.user_metadata?.avatar_url} />
            <AvatarFallback className="bg-sidebar-accent text-xs text-sidebar-foreground">
              {user?.email?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-xs font-medium text-sidebar-foreground">
              {user?.user_metadata?.full_name || user?.email}
            </p>
            <p className="truncate text-xs text-sidebar-foreground/50">{user?.email}</p>
          </div>
          <button
            onClick={() => signOut()}
            className="rounded-md p-1.5 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
