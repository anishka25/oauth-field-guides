"use client";
import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value);
        setOk(true);
        setTimeout(() => setOk(false), 1200);
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-md p-1 text-muted hover:bg-line hover:text-ink"
      aria-label="Copy"
    >
      {ok ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {label && <span className="text-xs">{ok ? "Copied" : label}</span>}
    </button>
  );
}

export function ShareButton() {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(window.location.href);
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm hover:bg-bg"
    >
      {ok ? <Check className="size-3.5" /> : <Share2 className="size-3.5" />}
      {ok ? "Link copied" : "Share guide"}
    </button>
  );
}
