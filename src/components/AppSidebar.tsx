import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth";
import {
  LayoutDashboard,
  Users,
  LogOut,
  Shield,
  Folder,
  CheckSquare,
  ShieldCheck,
  ExternalLink,
  ClipboardCheck,
  ClipboardList,
  Calendar,
  Mail,
  FolderOpen,
  TreesIcon,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/families", label: "Family Tree", icon: TreesIcon },
  { to: "/contacts", label: "Contacts", icon: Users, tasksBadge: true },
  { to: "/leads", label: "Discovery Leads", icon: UserPlus },
  { to: "/requests", label: "Client Requests", icon: ClipboardList },
  { to: "/review-queue", label: "Review Queue", icon: ClipboardCheck, reviewBadge: true },
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
  const [pendingTasksCount, setPendingTasksCount] = useState<number | null>(null);
  const [pendingReviewCount, setPendingReviewCount] = useState<number | null>(null);

  useEffect(() => {
    // Fetch Asana pending tasks
    (async () => {
      try {
        const res = await supabase.functions.invoke("asana-service", {
          body: { action: "getInbox" },
        });
        if (!res.error && res.data?.data) {
          const open = (res.data.data as any[]).filter((t: any) => !t.completed).length;
          setPendingTasksCount(open);
        }
      } catch {
        // silently fail
      }
    })();

    // Fetch pending review queue count
    (async () => {
      try {
        const { count } = await (supabase.from("review_queue" as any) as any)
          .select("id", { count: "exact", head: true })
          .eq("status", "pending");
        setPendingReviewCount(count ?? 0);
      } catch {
        // silently fail
      }
    })();
  }, []);

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary/20">
          <Shield className="h-5 w-5 text-sidebar-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-sidebar-foreground">ProsperWise</h2>
          <p className="text-xs text-sidebar-foreground/50">CRM</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ to, label, icon: Icon, tasksBadge, reviewBadge }: any) => (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              location.pathname === to || location.pathname.startsWith(to + "/")
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {tasksBadge && pendingTasksCount !== null && pendingTasksCount > 0 && (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-accent/25 px-1.5 text-[10px] font-bold text-accent border border-accent/30">
                {pendingTasksCount > 99 ? "99+" : pendingTasksCount}
              </span>
            )}
            {reviewBadge && pendingReviewCount !== null && pendingReviewCount > 0 && (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-accent/25 px-1.5 text-[10px] font-bold text-accent border border-accent/30">
                {pendingReviewCount > 99 ? "99+" : pendingReviewCount}
              </span>
            )}
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
