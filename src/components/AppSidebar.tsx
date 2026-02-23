import { Link, useLocation } from "react-router-dom";
import prosperwiseLogoColor from "@/assets/prosperwise-logo-color.png";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth";
import {
  LayoutDashboard,
  Users,
  LogOut,
  
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
  { to: "/requests", label: "Client Requests", icon: ClipboardList, requestsBadge: true },
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
  const [openRequestsCount, setOpenRequestsCount] = useState<number | null>(null);

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

    // Fetch open client requests count
    (async () => {
      try {
        const { count } = await supabase
          .from("portal_requests")
          .select("id", { count: "exact", head: true })
          .in("status", ["submitted", "in_progress"]);
        setOpenRequestsCount(count ?? 0);
      } catch {
        // silently fail
      }
    })();
  }, []);

  return (
    <aside className="flex h-full w-72 flex-col bg-background">
      {/* Logo */}
      <div className="px-6 pt-6 pb-2">
        <img src={prosperwiseLogoColor} alt="ProsperWise" className="h-10" />
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-4 pt-8">
        {navItems.map(({ to, label, icon: Icon, tasksBadge, reviewBadge, requestsBadge }: any) => {
          const active = location.pathname === to || location.pathname.startsWith(to + "/");
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-4 rounded-lg px-5 py-4 text-[15px] font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
              {tasksBadge && pendingTasksCount !== null && pendingTasksCount > 0 && (
                <span className={cn(
                  "ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
                  active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-accent/25 text-accent border border-accent/30"
                )}>
                  {pendingTasksCount > 99 ? "99+" : pendingTasksCount}
                </span>
              )}
              {reviewBadge && pendingReviewCount !== null && pendingReviewCount > 0 && (
                <span className={cn(
                  "ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
                  active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-accent/25 text-accent border border-accent/30"
                )}>
                  {pendingReviewCount > 99 ? "99+" : pendingReviewCount}
                </span>
              )}
              {requestsBadge && openRequestsCount !== null && openRequestsCount > 0 && (
                <span className={cn(
                  "ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
                  active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-accent/25 text-accent border border-accent/30"
                )}>
                  {openRequestsCount > 99 ? "99+" : openRequestsCount}
                </span>
              )}
            </Link>
          );
        })}

        <Separator className="my-4 bg-border" />

        <p className="px-5 pb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/50">
          Integrations
        </p>
        {externalLinks.map(({ href, label, icon: Icon }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-lg px-5 py-3 text-[15px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Icon className="h-5 w-5" />
            {label}
            <ExternalLink className="ml-auto h-3 w-3 opacity-30" />
          </a>
        ))}
      </nav>

    </aside>
  );
}
