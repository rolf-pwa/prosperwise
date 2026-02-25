import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useGoogleStatus } from "@/hooks/useGoogle";
import { listChatSpaces, listChatMessages, sendChatMessage } from "@/lib/google-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, Users, User, Hash, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useConnectGoogle } from "@/hooks/useGoogle";
import { toast } from "sonner";

interface ChatSpace {
  name: string;
  displayName: string;
  type: string;
  spaceType?: string;
  singleUserBotDm?: boolean;
  lastActiveTime?: string;
}

interface ChatMessage {
  name: string;
  sender: { name: string; displayName: string; type: string };
  createTime: string;
  text?: string;
  formattedText?: string;
}

const Chat = () => {
  const { data: googleStatus, isLoading: statusLoading } = useGoogleStatus();
  const connectGoogle = useConnectGoogle();
  const [spaces, setSpaces] = useState<ChatSpace[]>([]);
  const [dmNames, setDmNames] = useState<Record<string, string>>({});
  const [selectedSpace, setSelectedSpace] = useState<ChatSpace | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isConnected = googleStatus?.connected;

  useEffect(() => {
    if (isConnected) {
      loadSpaces();
    }
  }, [isConnected]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadSpaces() {
    setLoadingSpaces(true);
    setError(null);
    try {
      const data = await listChatSpaces();
      const loadedSpaces: ChatSpace[] = data.spaces || [];
      setSpaces(loadedSpaces);

      // Resolve DM names by fetching latest message from each DM
      const dmSpaces = loadedSpaces.filter(
        (s) => s.type === "DM" || s.spaceType === "DIRECT_MESSAGE"
      );
      const nameResults = await Promise.allSettled(
        dmSpaces.map(async (s) => {
          try {
            const msgData = await listChatMessages(s.name);
            const msgs = msgData.messages || [];
            // Find a message from someone other than "me" or just use the first sender
            const senderNames = new Set<string>();
            for (const msg of msgs) {
              if (msg.sender?.displayName) {
                senderNames.add(msg.sender.displayName);
              }
            }
            // Remove empty and pick a meaningful name
            senderNames.delete("");
            if (senderNames.size > 0) {
              return { spaceName: s.name, displayName: Array.from(senderNames).join(", ") };
            }
            return { spaceName: s.name, displayName: "Direct Message" };
          } catch {
            return { spaceName: s.name, displayName: "Direct Message" };
          }
        })
      );
      const names: Record<string, string> = {};
      for (const result of nameResults) {
        if (result.status === "fulfilled") {
          names[result.value.spaceName] = result.value.displayName;
        }
      }
      setDmNames(names);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingSpaces(false);
    }
  }

  async function loadMessages(space: ChatSpace) {
    setSelectedSpace(space);
    setLoadingMessages(true);
    setError(null);
    try {
      const data = await listChatMessages(space.name);
      // Reverse so oldest first
      setMessages((data.messages || []).reverse());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingMessages(false);
    }
  }

  async function handleSend() {
    if (!newMessage.trim() || !selectedSpace) return;
    setSending(true);
    try {
      await sendChatMessage(selectedSpace.name, newMessage.trim());
      setNewMessage("");
      // Reload messages
      await loadMessages(selectedSpace);
    } catch (e: any) {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  function getSpaceIcon(space: ChatSpace) {
    if (space.type === "DM" || space.spaceType === "DIRECT_MESSAGE") return <User className="h-4 w-4" />;
    if (space.type === "ROOM" || space.spaceType === "SPACE") return <Users className="h-4 w-4" />;
    return <Hash className="h-4 w-4" />;
  }

  function getSpaceDisplayName(space: ChatSpace) {
    if (space.displayName) return space.displayName;
    return dmNames[space.name] || "Direct Message";
  }

  if (statusLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!isConnected) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <MessageSquare className="h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground">Chat</h1>
          <p className="text-muted-foreground">Connect your Google Workspace account to access Chat.</p>
          <Button onClick={() => connectGoogle.mutate()} disabled={connectGoogle.isPending}>
            {connectGoogle.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Connect Google
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-8rem)] flex-col">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            Chat
          </h1>
          <Button variant="ghost" size="sm" onClick={loadSpaces} disabled={loadingSpaces}>
            <RefreshCw className={cn("h-4 w-4", loadingSpaces && "animate-spin")} />
          </Button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex flex-1 overflow-hidden rounded-xl border border-border bg-card">
          {/* Spaces List */}
          <div className="w-72 shrink-0 border-r border-border">
            <div className="border-b border-border px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Spaces & DMs
              </p>
            </div>
            <ScrollArea className="h-full">
              {loadingSpaces ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : spaces.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No spaces found
                </p>
              ) : (
                <div className="space-y-0.5 p-2">
                  {spaces.map((space) => (
                    <button
                      key={space.name}
                      onClick={() => loadMessages(space)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                        selectedSpace?.name === space.name
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      {getSpaceIcon(space)}
                      <span className="truncate font-medium">
                        {getSpaceDisplayName(space)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Message Area */}
          <div className="flex flex-1 flex-col">
            {selectedSpace ? (
              <>
                {/* Space Header */}
                <div className="flex items-center gap-3 border-b border-border px-6 py-3">
                  {getSpaceIcon(selectedSpace)}
                  <h2 className="font-semibold text-foreground">
                    {getSpaceDisplayName(selectedSpace)}
                  </h2>
                  <Badge variant="secondary" className="text-[10px]">
                    {selectedSpace.spaceType || selectedSpace.type}
                  </Badge>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 px-6 py-4">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No messages in this space
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((msg) => (
                        <div key={msg.name} className="group">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-semibold text-foreground">
                              {msg.sender?.displayName || "Unknown"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {msg.createTime
                                ? format(new Date(msg.createTime), "MMM d, h:mm a")
                                : ""}
                            </span>
                          </div>
                          <p className="mt-0.5 text-sm text-foreground/90 whitespace-pre-wrap">
                            {msg.text || msg.formattedText || ""}
                          </p>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* Input */}
                <div className="border-t border-border px-4 py-3">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSend();
                    }}
                    className="flex items-center gap-2"
                  >
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={`Message ${getSpaceDisplayName(selectedSpace)}...`}
                      className="flex-1"
                      disabled={sending}
                    />
                    <Button type="submit" size="icon" disabled={sending || !newMessage.trim()}>
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
                <MessageSquare className="h-10 w-10" />
                <p className="text-sm">Select a space to view messages</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Chat;
