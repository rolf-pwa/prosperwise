import { Check, Loader2 } from "lucide-react";

export interface PhaseData {
  id: string;         // e.g. "A"
  label: string;      // e.g. "The Transition Session"
  complete: boolean;
  inProgress: boolean;
}

const PHASES: { id: string; label: string; sublabel: string }[] = [
  { id: "A", label: "Transition", sublabel: "Triage & Strategy" },
  { id: "B", label: "Charter", sublabel: "Drafting & Ratification" },
  { id: "C", label: "Funding", sublabel: "Asset Alignment" },
  { id: "D", label: "Governance", sublabel: "Quarterly Reviews" },
  { id: "E", label: "Individuals", sublabel: "Personal Actions" },
];

interface Props {
  phases: PhaseData[];
  loading?: boolean;
}

export function PhaseProgressStepper({ phases, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#F59E0B" }} />
      </div>
    );
  }

  // Map phase id → data
  const phaseMap = new Map(phases.map((p) => [p.id, p]));

  // Find current active phase index
  const currentIndex = PHASES.findIndex((p) => {
    const data = phaseMap.get(p.id);
    return data?.inProgress;
  });
  const activeIndex = currentIndex >= 0 ? currentIndex : phases.filter((p) => p.complete).length;

  return (
    <div
      className="rounded-xl border p-5 space-y-4"
      style={{
        background: "rgba(245,158,11,0.04)",
        borderColor: "rgba(245,158,11,0.15)",
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#F59E0B" }}>
          Governance Journey
        </h3>
        <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
          {phases.filter((p) => p.complete).length} of {PHASES.length} complete
        </span>
      </div>

      {/* Desktop connector line */}
      <div className="hidden sm:flex items-center gap-0">
        {PHASES.map((phase, idx) => {
          const data = phaseMap.get(phase.id);
          const isComplete = data?.complete ?? false;
          const isActive = idx === activeIndex && !isComplete;
          const isFuture = !isComplete && !isActive;

          return (
            <div key={phase.id} className="flex items-center flex-1 last:flex-none">
              {/* Node */}
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all"
                  style={{
                    background: isComplete
                      ? "#F59E0B"
                      : isActive
                      ? "rgba(245,158,11,0.15)"
                      : "rgba(255,255,255,0.04)",
                    borderColor: isComplete
                      ? "#F59E0B"
                      : isActive
                      ? "#F59E0B"
                      : "rgba(255,255,255,0.12)",
                  }}
                >
                  {isComplete ? (
                    <Check className="h-4 w-4 text-black" strokeWidth={2.5} />
                  ) : (
                    <span
                      className="text-xs font-bold"
                      style={{ color: isActive ? "#F59E0B" : "rgba(255,255,255,0.3)" }}
                    >
                      {phase.id}
                    </span>
                  )}
                </div>
                <div className="text-center">
                  <p
                    className="text-[11px] font-semibold leading-tight"
                    style={{ color: isComplete || isActive ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)" }}
                  >
                    {phase.label}
                  </p>
                  <p
                    className="text-[10px] leading-tight"
                    style={{ color: "rgba(255,255,255,0.25)" }}
                  >
                    {phase.sublabel}
                  </p>
                </div>
              </div>

              {/* Connector */}
              {idx < PHASES.length - 1 && (
                <div
                  className="flex-1 h-0.5 mx-1 mt-[-20px]"
                  style={{
                    background: isComplete
                      ? "rgba(245,158,11,0.5)"
                      : "rgba(255,255,255,0.08)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: vertical list */}
      <div className="flex sm:hidden flex-col gap-2">
        {PHASES.map((phase, idx) => {
          const data = phaseMap.get(phase.id);
          const isComplete = data?.complete ?? false;
          const isActive = idx === activeIndex && !isComplete;

          return (
            <div key={phase.id} className="flex items-center gap-3">
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2"
                style={{
                  background: isComplete ? "#F59E0B" : isActive ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)",
                  borderColor: isComplete ? "#F59E0B" : isActive ? "#F59E0B" : "rgba(255,255,255,0.12)",
                }}
              >
                {isComplete ? (
                  <Check className="h-3.5 w-3.5 text-black" strokeWidth={2.5} />
                ) : (
                  <span className="text-[11px] font-bold" style={{ color: isActive ? "#F59E0B" : "rgba(255,255,255,0.3)" }}>
                    {phase.id}
                  </span>
                )}
              </div>
              <div>
                <p
                  className="text-xs font-semibold"
                  style={{ color: isComplete || isActive ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)" }}
                >
                  {phase.label}
                </p>
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                  {phase.sublabel}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
