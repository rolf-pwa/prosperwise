import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface PortalRequest {
  id: string;
  request_type: string;
  request_description: string;
  status: string;
  messages?: {
    id: string;
    sender_type: string;
    sender_name: string | null;
    content: string;
    created_at: string;
  }[];
}

const TYPE_LABELS: Record<string, string> = {
  banking_withdrawal: "Banking & Withdrawals",
  personal_info: "Personal Info",
  document_request: "Document Request",
  general_inquiry: "General Inquiry",
};

function getSeenMessageIds(contactId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`portal_seen_msgs_${contactId}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function markMessagesSeen(contactId: string, ids: string[]) {
  const existing = getSeenMessageIds(contactId);
  ids.forEach((id) => existing.add(id));
  localStorage.setItem(`portal_seen_msgs_${contactId}`, JSON.stringify([...existing]));
}

interface Props {
  requests: PortalRequest[];
  contactId: string;
  onNavigateToRequests: () => void;
}

export function PortalNotificationBell({ requests, contactId, onNavigateToRequests }: Props) {
  const [open, setOpen] = useState(false);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSeenIds(getSeenMessageIds(contactId));
  }, [contactId]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Collect all unread advisor messages across requests
  const unreadMessages = requests.flatMap((req) =>
    (req.messages || [])
      .filter((m) => m.sender_type === "advisor" && !seenIds.has(m.id))
      .map((m) => ({ ...m, requestType: req.request_type, requestId: req.id }))
  ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const unreadCount = unreadMessages.length;

  const handleOpen = () => {
    setOpen(!open);
  };

  const handleMarkAllRead = () => {
    const allAdvisorMsgIds = requests.flatMap((req) =>
      (req.messages || []).filter((m) => m.sender_type === "advisor").map((m) => m.id)
    );
    markMessagesSeen(contactId, allAdvisorMsgIds);
    setSeenIds(getSeenMessageIds(contactId));
  };

  const handleClickNotif = (requestId: string) => {
    // Mark all messages in this request as seen
    const req = requests.find((r) => r.id === requestId);
    if (req) {
      const ids = (req.messages || []).filter((m) => m.sender_type === "advisor").map((m) => m.id);
      markMessagesSeen(contactId, ids);
      setSeenIds(getSeenMessageIds(contactId));
    }
    setOpen(false);
    onNavigateToRequests();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-border bg-background shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-accent hover:text-accent/80 font-medium"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {unreadMessages.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No new notifications
              </div>
            ) : (
              unreadMessages.slice(0, 20).map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => handleClickNotif(msg.requestId)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 border-b border-border last:border-0 bg-accent/5"
                >
                  <span className="text-base mt-0.5">💬</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight text-foreground">
                      New reply on {TYPE_LABELS[msg.requestType] || msg.requestType}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {msg.content}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {format(new Date(msg.created_at), "MMM d, h:mm a")}
                    </p>
                  </div>
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
