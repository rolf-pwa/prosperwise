import { useGmailMessages } from "@/hooks/useGoogle";
import { useGoogleStatus } from "@/hooks/useGoogle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Send } from "lucide-react";
import { format } from "date-fns";

interface ContactEmailsProps {
  contactEmail: string | null;
}

export function ContactEmails({ contactEmail }: ContactEmailsProps) {
  const { data: status } = useGoogleStatus();
  const query = contactEmail ? `from:${contactEmail} OR to:${contactEmail}` : undefined;
  const { data, isLoading, error } = useGmailMessages(query, !!contactEmail && status?.connected);

  if (!contactEmail) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            Email History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No email address on file.</p>
        </CardContent>
      </Card>
    );
  }

  if (!status?.connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            Email History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Connect Google on the Dashboard to see emails.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4" />
          Email History
        </CardTitle>
        {contactEmail && (
          <a
            href={`https://mail.google.com/mail/u/0/?view=cm&to=${encodeURIComponent(contactEmail)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="ghost" size="sm">
              <Send className="mr-1 h-3 w-3" />
              Compose
            </Button>
          </a>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground animate-pulse">Loading emails...</p>
        ) : error ? (
          <p className="text-sm text-destructive">Failed to load emails.</p>
        ) : !data?.messages?.length ? (
          <p className="text-sm text-muted-foreground">No emails found with this contact.</p>
        ) : (
          <ul className="space-y-3">
            {data.messages.slice(0, 10).map((msg: any) => {
              const parsedDate = msg.date ? new Date(msg.date) : null;
              return (
                <li key={msg.id}>
                  <a
                    href={`https://mail.google.com/mail/u/0/#all/${msg.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-md border-b border-border/50 pb-3 last:border-0 last:pb-0 transition-colors hover:bg-muted/50 -mx-1 px-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {msg.subject || "(No subject)"}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {msg.from}
                        </p>
                        {msg.snippet && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/70">
                            {msg.snippet}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {parsedDate && !isNaN(parsedDate.getTime())
                          ? format(parsedDate, "MMM d")
                          : ""}
                      </span>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
