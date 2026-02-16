import { Calendar, Clock, MapPin, Video } from "lucide-react";
import { format, parseISO } from "date-fns";

interface Props {
  meetings: any[];
}

export function PortalMeetings({ meetings }: Props) {
  if (!meetings.length) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-8 text-center">
        <Calendar className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">No upcoming meetings scheduled.</p>
      </div>
    );
  }

  const bookingLinks = [
    { label: "Charter Review (Video)", href: "https://calendar.app.google/Yvvk8qnhSGUmzdEC8", icon: Video },
    { label: "Charter Review (In Person)", href: "https://calendar.app.google/xVawK2BM665pZQ91A", icon: MapPin },
  ];

  return (
    <div className="space-y-6">
      {/* Booking Links */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground font-serif mb-3">Book a Meeting</h3>
        <div className="flex flex-wrap gap-3">
          {bookingLinks.map(({ label, href, icon: Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-accent/20 bg-accent/5 px-4 py-2.5 text-sm font-medium text-accent hover:bg-accent/10 transition-colors"
            >
              <Icon className="h-4 w-4" />
              {label}
            </a>
          ))}
        </div>
      </div>

      {/* Upcoming Meetings */}
      <div className="space-y-3">
      {meetings.map((event: any) => {
        const start = event.start?.dateTime
          ? parseISO(event.start.dateTime)
          : event.start?.date
          ? parseISO(event.start.date)
          : null;
        const end = event.end?.dateTime ? parseISO(event.end.dateTime) : null;
        const isAllDay = !event.start?.dateTime;

        return (
          <div
            key={event.id}
            className="rounded-lg border border-border bg-card p-4 hover:border-accent/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-foreground truncate">
                  {event.summary || "Untitled Event"}
                </h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {start
                      ? isAllDay
                        ? format(start, "MMM d, yyyy")
                        : `${format(start, "MMM d · h:mm a")}${end ? ` – ${format(end, "h:mm a")}` : ""}`
                      : "TBD"}
                  </span>
                  {event.location && (
                    <span className="flex items-center gap-1 truncate">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{event.location}</span>
                    </span>
                  )}
                  {event.hangoutLink && (
                    <a
                      href={event.hangoutLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-accent hover:underline"
                    >
                      <Video className="h-3 w-3" />
                      Join Meeting
                    </a>
                  )}
                </div>
              </div>
              {event.status === "confirmed" && (
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary border border-primary/20">
                  Confirmed
                </span>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
