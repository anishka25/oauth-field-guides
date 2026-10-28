import {
  AlertTriangle, Bot, CheckCircle2, CircleDashed, Clock, ExternalLink, FlaskConical,
  HelpCircle, Hourglass, Info, Link2, OctagonAlert, ShieldAlert, User, XCircle,
} from "lucide-react";
import type { Evidence as Ev, Guide } from "@/lib/schema";
import { AppIcon } from "./app-icon";
import { CopyButton } from "./copy";

const DIFF = [
  { c: "bg-emerald-500", t: "text-emerald-600 dark:text-emerald-400" },
  { c: "bg-lime-500", t: "text-lime-600 dark:text-lime-400" },
  { c: "bg-amber-500", t: "text-amber-600 dark:text-amber-400" },
  { c: "bg-orange-500", t: "text-orange-600 dark:text-orange-400" },
  { c: "bg-rose-500", t: "text-rose-600 dark:text-rose-400" },
];
export const diffStyle = (d: number) => DIFF[Math.min(Math.max(d, 1), 5) - 1];

export function DifficultyMeter({ value, size = "md" }: { value: number; size?: "sm" | "md" }) {
  const s = diffStyle(value);
  return (
    <div className="flex gap-1" aria-label={`Difficulty ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`${size === "sm" ? "h-1.5 w-4" : "h-2 w-8"} rounded-full ${i <= value ? s.c : "bg-line"}`}
        />
      ))}
    </div>
  );
}

export function waitLabel(g: Guide) {
  const w = g.timeline.approvalWait;
  if (w.unit === "none" || w.max === 0) return "No review wait";
  return `${w.min}–${w.max} ${w.unit} review`;
}

export function setupLabel(g: Guide) {
  const { min, max } = g.timeline.setupMinutes;
  const f = (m: number) => (m >= 120 ? `${Math.round(m / 60)}h` : `${m}m`);
  return `${f(min)}–${f(max)} hands-on`;
}

/* ---------- evidence ---------- */

const EV = {
  tested: { icon: FlaskConical, cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/25", label: "Tested" },
  sourced: { icon: Link2, cls: "bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-sky-500/25", label: "Sourced" },
  inferred: { icon: CircleDashed, cls: "bg-zinc-500/10 text-muted ring-zinc-500/25", label: "Inferred" },
};

export function EvidenceBadge({ ev, sources }: { ev: Ev; sources: Guide["sources"] }) {
  const e = EV[ev.kind];
  const idx = ev.sourceIds
    .map((id) => sources.findIndex((s) => s.id === id))
    .filter((i) => i >= 0);
  return (
    <span className="group relative inline-flex items-center gap-1">
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${e.cls}`}>
        <e.icon className="size-3" /> {e.label}
      </span>
      {idx.map((i) => (
        <a key={i} href={`#src-${i + 1}`} className="font-mono text-[11px] text-accent hover:underline">
          [{i + 1}]
        </a>
      ))}
      {ev.note && (
        <span className="pointer-events-none absolute bottom-full left-0 z-10 mb-1 hidden w-64 rounded-lg bg-ink px-2.5 py-1.5 text-xs text-bg shadow-lg group-hover:block">
          {ev.note}
        </span>
      )}
    </span>
  );
}

/* ---------- verdict + timeline ---------- */

export function VerdictHero({ g }: { g: Guide }) {
  const s = diffStyle(g.verdict.difficulty);
  return (
    <section className="card overflow-hidden">
      <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:p-8">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">{g.category}</span>
            {g.origin === "agent" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                <Bot className="size-3" /> Agent-generated · {g.mode}
              </span>
            )}
            <span className="text-xs text-muted">Verified {g.lastVerified}</span>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <AppIcon name={g.name} website={g.website} size={56} />
            <div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{g.name}</h1>
              <a href={g.website} className="text-sm text-muted hover:text-ink" target="_blank">{g.website.replace(/^https?:\/\//, "")}</a>
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed">{g.verdict.headline}</p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{g.summary}</p>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <span className="eyebrow">Difficulty</span>
          <span className={`text-2xl font-semibold ${s.t}`}>{g.verdict.label}</span>
          <DifficultyMeter value={g.verdict.difficulty} />
        </div>
      </div>
      {g.mode === "research-only" && (
        <div className="flex items-start gap-2 border-t border-line bg-amber-500/5 px-6 py-3 text-sm text-amber-800 md:px-8 dark:text-amber-200">
          <Info className="mt-0.5 size-4 shrink-0" />
          {g.origin === "agent"
            ? "Research-only: the agent didn't get past the provider's login, so the hands-on steps come from documentation and haven't been tested."
            : "Research-only: built from the official docs plus read-only probes of the live endpoints. The steps haven't been run with a real account."}
        </div>
      )}
    </section>
  );
}

export function TimelineBar({ g }: { g: Guide }) {
  const t = g.timeline;
  const w = t.approvalWait;
  const toHours = (n: number, u: string) => (u === "weeks" ? n * 7 * 8 : u === "days" ? n * 8 : 0);
  const work = Math.max(t.setupMinutes.max / 60, 0.25);
  const wait = toHours(w.max, w.unit);
  const total = work + wait;
  const workPct = wait ? Math.max((work / total) * 100, 22) : 100;
  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Time to ready</h2>
        <p className="text-sm text-muted">{t.summary}</p>
      </div>
      <div className="mt-4 flex h-9 overflow-hidden rounded-xl text-xs font-medium">
        <div className="flex items-center gap-1.5 bg-ink px-3 text-bg" style={{ width: `${workPct}%` }}>
          <Clock className="size-3.5 shrink-0" />
          <span className="truncate">{setupLabel(g)}</span>
        </div>
        {wait > 0 && (
          <div
            className="flex flex-1 items-center gap-1.5 px-3 text-amber-900 dark:text-amber-200"
            style={{ background: "repeating-linear-gradient(135deg, rgb(245 158 11 / .18) 0 8px, rgb(245 158 11 / .08) 8px 16px)" }}
          >
            <Hourglass className="size-3.5 shrink-0" />
            <span className="truncate">{waitLabel(g)}</span>
          </div>
        )}
      </div>
      {wait > 0 && <p className="mt-2 text-xs text-muted">The wait applies {w.appliesWhen}.</p>}
    </section>
  );
}

/* ---------- agent vs human ---------- */

export function AgentHumanSplit({ g }: { g: Guide }) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="card p-6">
        <div className="flex items-center gap-2 font-semibold"><Bot className="size-4 text-accent" /> What an agent can do</div>
        <ul className="mt-3 space-y-2 text-sm">
          {g.agentVsHuman.agent.map((a) => (
            <li key={a} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" />{a}</li>
          ))}
        </ul>
      </div>
      <div className="card p-6">
        <div className="flex items-center gap-2 font-semibold"><User className="size-4" /> Where you take over</div>
        <ul className="mt-3 space-y-2 text-sm">
          {g.agentVsHuman.human.map((a) => (
            <li key={a} className="flex gap-2"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-ink" />{a}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- steps ---------- */

const ACTOR = {
  agent: { icon: Bot, ring: "bg-accent text-white", label: "Agent" },
  human: { icon: User, ring: "bg-ink text-bg", label: "You" },
  wait: { icon: Hourglass, ring: "bg-amber-500 text-white", label: "Wait" },
};

export function Stepper({ g }: { g: Guide }) {
  return (
    <section className="card p-6">
      <h2 className="font-semibold">Setup path</h2>
      <ol className="mt-5">
        {g.steps.map((s, i) => {
          const a = ACTOR[s.actor];
          return (
            <li key={i} className="relative flex gap-4 pb-7 last:pb-0">
              {i < g.steps.length - 1 && <span className="absolute left-[15px] top-9 h-[calc(100%-2.5rem)] w-px bg-line" />}
              <span className={`grid size-8 shrink-0 place-items-center rounded-full ${a.ring}`}>
                <a.icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="font-medium">{s.title}</h3>
                  <span className="text-xs text-muted">{a.label} · {s.duration}</span>
                  <EvidenceBadge ev={s.evidence} sources={g.sources} />
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.detail}</p>
                {s.url && (
                  <a href={s.url} target="_blank" className="mt-2 inline-flex items-center gap-1 text-sm text-accent hover:underline">
                    Open <ExternalLink className="size-3" />
                  </a>
                )}
                {s.copyables.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {s.copyables.map((c) => (
                      <div key={c.label} className="flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-1.5">
                        <span className="text-xs text-muted">{c.label}</span>
                        <code className="min-w-0 flex-1 truncate font-mono text-xs">{c.value}</code>
                        <CopyButton value={c.value} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ---------- requirements ---------- */

const REQ = {
  required: "bg-ink text-bg",
  conditional: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  optional: "bg-line text-muted",
};

export function Requirements({ g }: { g: Guide }) {
  return (
    <section className="card p-6">
      <h2 className="font-semibold">Requirements checklist</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {g.requirements.map((r) => (
          <div key={r.item} className="rounded-xl border border-line p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium">{r.item}</span>
              <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${REQ[r.required]}`}>{r.required}</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">{r.note}</p>
            <div className="mt-2"><EvidenceBadge ev={r.evidence} sources={g.sources} /></div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- scopes ---------- */

const TIER = {
  basic: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  sensitive: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  restricted: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

export function ScopeTable({ g }: { g: Guide }) {
  if (!g.scopes.length) return null;
  return (
    <section className="card overflow-hidden">
      <div className="p-6 pb-3">
        <h2 className="font-semibold">Scopes and review tiers</h2>
        <p className="mt-1 text-sm text-muted">The scopes you request decide whether a review applies. Request as few as possible.</p>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {g.scopes.map((s) => (
            <tr key={s.name} className="border-t border-line">
              <td className="px-6 py-2.5 font-mono text-xs">{s.name}</td>
              <td className="py-2.5"><span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${TIER[s.tier]}`}>{s.tier}</span></td>
              <td className="px-6 py-2.5 text-muted">{s.purpose}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ---------- endpoints ---------- */

export function Endpoints({ g }: { g: Guide }) {
  const e = g.endpoints;
  const rows: [string, string | null][] = [
    ["Authorize", e.authorizeUrl],
    ["Token", e.tokenUrl],
    ["Discovery", e.discoveryUrl],
  ];
  const pill = (k: string, v: string) => (
    <div className="rounded-xl border border-line p-3">
      <div className="eyebrow">{k}</div>
      <div className="mt-1 text-sm font-medium">{v}</div>
    </div>
  );
  return (
    <section className="card p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Technical spec</h2>
        <EvidenceBadge ev={e.evidence} sources={g.sources} />
      </div>
      <div className="mt-4 space-y-1.5">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="flex items-center gap-3 rounded-lg bg-bg px-3 py-2">
            <span className="w-20 shrink-0 text-xs text-muted">{k}</span>
            <code className="min-w-0 flex-1 truncate font-mono text-xs">{v}</code>
            <CopyButton value={v!} />
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        {pill("PKCE", e.pkce)}
        {pill("Dynamic registration", e.dynamicRegistration)}
        {pill("Refresh tokens", e.refreshTokens)}
        {pill("Access token TTL", e.tokenLifetime)}
      </div>
    </section>
  );
}

/* ---------- blockers & gotchas ---------- */

export function Blockers({ g }: { g: Guide }) {
  if (!g.blockers.length) return null;
  return (
    <section className="card p-6">
      <h2 className="font-semibold">If you get stuck</h2>
      <div className="mt-4 space-y-2">
        {g.blockers.map((b) => (
          <details key={b.symptom} className="group rounded-xl border border-line open:bg-bg">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium">
              <OctagonAlert className="size-4 shrink-0 text-rose-500" />
              {b.symptom}
              <span className="ml-auto text-muted transition group-open:rotate-45">+</span>
            </summary>
            <div className="space-y-2 px-4 pb-4 pl-10 text-sm">
              <p><span className="text-muted">Why: </span>{b.cause}</p>
              <p><span className="text-muted">Fix: </span>{b.fix}</p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

const SEV = {
  info: { icon: Info, cls: "border-sky-500/30 bg-sky-500/5", ic: "text-sky-500" },
  warn: { icon: AlertTriangle, cls: "border-amber-500/30 bg-amber-500/5", ic: "text-amber-500" },
  critical: { icon: ShieldAlert, cls: "border-rose-500/30 bg-rose-500/5", ic: "text-rose-500" },
};

export function Gotchas({ g }: { g: Guide }) {
  if (!g.gotchas.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Nuances that bite</h2>
      {g.gotchas.map((x) => {
        const s = SEV[x.severity];
        return (
          <div key={x.title} className={`flex gap-3 rounded-2xl border p-4 ${s.cls}`}>
            <s.icon className={`mt-0.5 size-4 shrink-0 ${s.ic}`} />
            <div>
              <div className="text-sm font-medium">{x.title}</div>
              <p className="mt-1 text-sm leading-relaxed text-muted">{x.detail}</p>
            </div>
          </div>
        );
      })}
    </section>
  );
}

/* ---------- evidence log ---------- */

const OUT = {
  pass: { icon: CheckCircle2, cls: "text-emerald-500" },
  fail: { icon: XCircle, cls: "text-rose-500" },
  blocked: { icon: CircleDashed, cls: "text-amber-500" },
};

export function TestedLog({ g }: { g: Guide }) {
  return (
    <section className="card p-6">
      <h2 className="flex items-center gap-2 font-semibold"><FlaskConical className="size-4" /> What we actually tested</h2>
      {g.tested.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nothing was run against this provider. Every claim comes from documentation or inference.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line font-mono text-xs">
          {g.tested.map((t, i) => {
            const o = OUT[t.outcome];
            return (
              <li key={i} className="flex gap-3 py-2.5">
                <o.icon className={`size-4 shrink-0 ${o.cls}`} />
                <div className="min-w-0">
                  <div className="text-ink">{t.check}</div>
                  <div className="mt-0.5 break-words text-muted">{t.result}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function Uncertainties({ g }: { g: Guide }) {
  if (!g.uncertainties.length) return null;
  return (
    <section className="rounded-2xl border border-dashed border-line p-6">
      <h2 className="flex items-center gap-2 font-semibold text-muted"><HelpCircle className="size-4" /> Not verified</h2>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
        {g.uncertainties.map((u) => <li key={u}>{u}</li>)}
      </ul>
    </section>
  );
}

export function Sources({ g }: { g: Guide }) {
  return (
    <section>
      <h2 className="eyebrow">Sources</h2>
      <ol className="mt-2 space-y-1 text-sm">
        {g.sources.map((s, i) => (
          <li key={s.id} id={`src-${i + 1}`} className="flex gap-2">
            <span className="font-mono text-xs text-muted">[{i + 1}]</span>
            <a href={s.url} target="_blank" className="hover:text-accent hover:underline">{s.title}</a>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function GuideView({ g }: { g: Guide }) {
  return (
    <div className="space-y-6">
      <VerdictHero g={g} />
      <TimelineBar g={g} />
      <AgentHumanSplit g={g} />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Stepper g={g} />
          <Blockers g={g} />
        </div>
        <div className="space-y-6">
          <Gotchas g={g} />
          <TestedLog g={g} />
          <Uncertainties g={g} />
        </div>
      </div>
      <Requirements g={g} />
      <ScopeTable g={g} />
      <Endpoints g={g} />
      <Sources g={g} />
    </div>
  );
}
