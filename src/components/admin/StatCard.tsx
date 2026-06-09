import { ReactNode } from "react";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: boolean;
  info?: string;
}

export default function StatCard({ label, value, sub, accent, info }: StatCardProps) {
  return (
    <div
      className={`bg-card rounded-2xl p-4 border ${
        accent ? "border-primary/40 shadow-card" : "border-border"
      }`}
    >
      <div className="flex items-center gap-1">
        <p className="font-body text-[11px] text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        {info && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full hover:bg-secondary transition-colors"
                  aria-label={`What is ${label}?`}
                >
                  <Info className="w-3 h-3 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[220px] text-xs">
                <p>{info}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <p className="font-display text-2xl font-bold text-foreground mt-1 leading-none">
        {value}
      </p>
      {sub && (
        <p className="font-body text-xs text-muted-foreground mt-1.5">{sub}</p>
      )}
    </div>
  );
}
