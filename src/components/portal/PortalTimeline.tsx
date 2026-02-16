import { format } from "date-fns";
import { CheckCircle2, Clock, Shield } from "lucide-react";

interface Props {
  auditTrail: any[];
}

export function PortalTimeline({ auditTrail }: Props) {
  if (auditTrail.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Clock className="h-12 w-12 text-slate-700 mb-4" />
        <h3 className="text-lg font-semibold text-slate-300 font-serif">Governance Timeline</h3>
        <p className="text-sm text-slate-500 mt-2 max-w-sm">
          Key governance decisions will appear here as they are ratified by your Personal CFO.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-sanctuary-bronze" />
        <h2 className="text-lg font-semibold text-slate-100 font-serif">Governance Timeline</h2>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-800" />

        <div className="space-y-0">
          {auditTrail.map((entry: any, i: number) => (
            <div key={entry.id} className="relative flex gap-4 pb-6">
              {/* Dot */}
              <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 border border-slate-700">
                <CheckCircle2 className="h-4 w-4 text-sanctuary-bronze" />
              </div>

              {/* Content */}
              <div className="flex-1 rounded-lg bg-slate-900 border border-slate-800 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-medium text-sanctuary-bronze uppercase tracking-wider">
                      {entry.action_type}
                    </span>
                    <p className="text-sm text-slate-200 mt-1">
                      {entry.action_description}
                    </p>
                  </div>
                  <time className="text-xs text-slate-500 whitespace-nowrap">
                    {format(new Date(entry.approved_at || entry.created_at), "MMM d, yyyy")}
                  </time>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
