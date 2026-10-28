"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Loader2, Lock } from "lucide-react";

export function UnlockForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/generate";
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await fetch("/api/unlock", { method: "POST", body: JSON.stringify({ code }) });
    setBusy(false);
    if (!r.ok) return setErr((await r.json()).error);
    router.replace(next.startsWith("/") && !next.startsWith("//") ? next : "/generate");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card mt-6 space-y-3 p-5">
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Access code"
          className="h-11 w-full rounded-xl border border-line bg-bg pl-9 pr-3 outline-none focus:ring-2 focus:ring-accent/30"
        />
      </div>
      {err && <p className="text-sm text-rose-600 dark:text-rose-300">{err}</p>}
      <button disabled={busy || !code} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink text-sm font-medium text-bg disabled:opacity-40">
        {busy && <Loader2 className="size-4 animate-spin" />} Unlock
      </button>
    </form>
  );
}
