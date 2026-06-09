import { useState } from "react";
import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";

export interface ConsentState {
  age16: boolean;
  tos: boolean;
}

interface Props {
  value: ConsentState;
  onChange: (v: ConsentState) => void;
  id?: string;
}

export function ConsentGate({ value, onChange, id = "consent" }: Props) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/50 p-3">
      <label htmlFor={`${id}-age`} className="flex items-start gap-3 cursor-pointer">
        <Checkbox
          id={`${id}-age`}
          checked={value.age16}
          onCheckedChange={(c) => onChange({ ...value, age16: c === true })}
          className="mt-0.5"
        />
        <span className="font-body text-xs text-foreground leading-relaxed">
          I confirm I am at least 16 years old.
        </span>
      </label>
      <label htmlFor={`${id}-tos`} className="flex items-start gap-3 cursor-pointer">
        <Checkbox
          id={`${id}-tos`}
          checked={value.tos}
          onCheckedChange={(c) => onChange({ ...value, tos: c === true })}
          className="mt-0.5"
        />
        <span className="font-body text-xs text-foreground leading-relaxed">
          I agree to the{" "}
          <Link to="/terms" target="_blank" className="underline underline-offset-2">Terms</Link>{" "}
          and{" "}
          <Link to="/privacy" target="_blank" className="underline underline-offset-2">Privacy Policy</Link>.
        </span>
      </label>
    </div>
  );
}

export const CONSENT_KEY = "okiro.consent.v1";
export const CONSENT_TOS_VERSION = "2026-06-09";

export function readConsent(): { age16: boolean; tos: boolean; at: string } | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeConsent() {
  try {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ age16: true, tos: true, at: new Date().toISOString() }),
    );
  } catch { /* ignore */ }
}

export function useConsentState() {
  return useState<ConsentState>({ age16: false, tos: false });
}
