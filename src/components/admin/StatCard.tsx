import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: boolean;
}

export default function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <div
      className={`bg-card rounded-2xl p-4 border ${
        accent ? "border-primary/40 shadow-card" : "border-border"
      }`}
    >
      <p className="font-body text-[11px] text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p className="font-display text-2xl font-bold text-foreground mt-1 leading-none">
        {value}
      </p>
      {sub && (
        <p className="font-body text-xs text-muted-foreground mt-1.5">{sub}</p>
      )}
    </div>
  );
}
