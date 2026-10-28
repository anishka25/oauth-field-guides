"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight, Bot, ExternalLink, KeyRound, Brain, CheckCircle2, Globe, Loader2, MessageSquare, MousePointer2,
  Search, Send, Sparkles, Terminal, TriangleAlert,
} from "lucide-react";
import { GuideView } from "@/components/guide";
import type { Guide } from "@/lib/schema";

type Item = {
  type: "item"; phase: string; id: string; kind: string;
  command?: string; output?: string; exit?: number; status?: string;
  server?: string; tool?: string; args?: string; result?: string; error?: string;
  query?: string; text?: string; items?: { text: string; completed: boolean }[];
};
type Ev =
  | Item
  | { type: "status"; text: string; t: number }
  | { type: "question"; qid: string; question: string; context: string; options: string[] }
  | { type: "answer"; qid: string; answer: string }
  | { type: "authorize"; qid: string; url: string; instructions: string }
  | { type: "callback"; params: Record<string, string> }
  | { type: "saved"; slug: string; guide: Guide }
  | { type: "error"; text: string }
  | { type: "usage" | "end" };

const EXAMPLES = ["Linear", "HubSpot", "Zoom", "Dropbox", "Atlassian Jira", "https://www.figma.com"];

export function Generator() {
  const params = useSearchParams();
  const [app, setApp] = useState(params.get("app") ?? "");
  const [runId, setRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<Ev[]>([]);
  const [starting, setStarting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  async function start(name = app) {
    if (!name.trim()) return;
    setApp(name);
    setStarting(true); setErr(null); setEvents([]); setDone(false);
    const r = await fetch("/api/runs", { method: "POST", body: JSON.stringify({ app: name }) });
    const j = await r.json();
    setStarting(false);
    if (!r.ok) return setErr(j.error);
    setRunId(j.id);
  }

  useEffect(() => {
    if (!runId) return;
    // Serverless functions are capped (300s on Vercel Hobby), so the stream
    // can drop mid-run. The server replays the whole log on each connection,
    // so reconnect and rebuild the list from scratch until "end" arrives.
    let es: EventSource | null = null;
    let ended = false;
    let failures = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      let first = true;
      es = new EventSource(`/api/runs/${runId}/events`);
      es.onmessage = (m) => {
        const ev = JSON.parse(m.data) as Ev;
        failures = 0;
        setEvents((prev) => {
          const xs = first ? [] : prev;
          first = false;
          // item.started → item.completed replace in place
          if (ev.type === "item") {
            const i = xs.findIndex((x) => x.type === "item" && x.id === ev.id);
            if (i >= 0) { const c = xs.slice(); c[i] = ev; return c; }
          }
          return [...xs, ev];
        });
        if (ev.type === "end") { ended = true; setDone(true); es?.close(); }
      };
      es.onerror = () => {
        es?.close();
        if (ended) return;
        if (++failures > 5) return setDone(true);
        retry = setTimeout(connect, 1000 * failures);
      };
    };
    connect();
    return () => { ended = true; clearTimeout(retry); es?.close(); };
  }, [runId]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [events.length]);

  const answered = new Map(events.filter((e) => e.type === "answer").map((e) => [(e as { qid: string }).qid, (e as { answer: string }).answer]));
  const saved = events.find((e) => e.type === "saved") as Extract<Ev, { type: "saved" }> | undefined;
  const running = !!runId && !done;

  return (
    <div className="space-y-6">
      <form onSubmit={(e) => { e.preventDefault(); start(); }} className="card flex items-center gap-2 p-2">
        <Sparkles className="ml-3 size-5 text-accent" />
        <input
          value={app}
          onChange={(e) => setApp(e.target.value)}
          disabled={running || starting}
          placeholder="App name or website, e.g. “Linear” or “https://zoom.us”"
          className="h-11 flex-1 bg-transparent px-2 outline-none placeholder:text-muted"
        />
        <button disabled={running || starting || !app.trim()} className="flex h-11 items-center gap-2 rounded-xl bg-ink px-5 text-sm font-medium text-bg disabled:opacity-40">
          {starting ? <><Loader2 className="size-4 animate-spin" /> Starting sandbox…</> : running ? <><Loader2 className="size-4 animate-spin" /> Investigating</> : <>Investigate <ArrowRight className="size-4" /></>}
        </button>
      </form>
      {!runId && !starting && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((x) => (
            <button key={x} onClick={() => start(x)} className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-muted hover:text-ink">{x}</button>
          ))}
        </div>
      )}
      {err && <p className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">{err}</p>}

      {(starting || runId) && (
        <section className="card p-2">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm">
            <Bot className="size-4 text-accent" />
            <span className="font-medium">Agent activity</span>
            {runId && <span className="font-mono text-xs text-muted">{runId}</span>}
            <span className="ml-auto flex items-center gap-1.5 text-xs text-muted">
              {running || starting ? <><span className="size-2 animate-pulse rounded-full bg-emerald-500" /> live</> : "finished"}
            </span>
          </div>
          <div className="max-h-[560px] space-y-1 overflow-y-auto p-2">
            {starting && <Row icon={Loader2} spin title="Booting Modal sandbox (the first run builds the image, which takes a few minutes)" />}
            {runId && events.length === 0 && <Row icon={Loader2} spin title="Waiting for the agent to start…" />}
            {events.map((e, i) => (
              <EventRow key={i} e={e} runId={runId!} answered={answered} />
            ))}
            <div ref={bottom} />
          </div>
        </section>
      )}

      {saved && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl bg-emerald-500/10 p-4 text-sm">
            <span className="flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-200"><CheckCircle2 className="size-4" /> Guide saved and shareable</span>
            <Link href={`/guides/${saved.slug}`} className="flex items-center gap-1 font-medium text-accent hover:underline">/guides/{saved.slug} <ArrowRight className="size-4" /></Link>
          </div>
          <GuideView g={saved.guide} />
        </div>
      )}
    </div>
  );
}

function Row({ icon: Icon, title, body, spin, tone }: { icon: React.ElementType; title: React.ReactNode; body?: React.ReactNode; spin?: boolean; tone?: string }) {
  return (
    <div className="flex gap-3 rounded-xl px-3 py-2 hover:bg-bg">
      <Icon className={`mt-0.5 size-4 shrink-0 ${spin ? "animate-spin" : ""} ${tone ?? "text-muted"}`} />
      <div className="min-w-0 flex-1 text-sm">
        <div className="break-words">{title}</div>
        {body}
      </div>
    </div>
  );
}

function Details({ children }: { children: React.ReactNode }) {
  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-xs text-muted">output</summary>
      <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-bg p-2 font-mono text-[11px] text-muted">{children}</pre>
    </details>
  );
}

function EventRow({ e, runId, answered }: { e: Ev; runId: string; answered: Map<string, string> }) {
  if (e.type === "status") return <Row icon={Sparkles} tone="text-accent" title={e.text} />;
  if (e.type === "error") return <Row icon={TriangleAlert} tone="text-rose-500" title={<span className="text-rose-600 dark:text-rose-300">{e.text}</span>} />;
  if (e.type === "question") return <QuestionCard q={e} runId={runId} answer={answered.get(e.qid)} />;
  if (e.type === "authorize") return <AuthorizeCard a={e} runId={runId} answer={answered.get(e.qid)} />;
  if (e.type === "callback") {
    const ok = "code" in e.params;
    return (
      <Row icon={ok ? CheckCircle2 : TriangleAlert} tone={ok ? "text-emerald-500" : "text-amber-500"}
        title={ok ? "The provider redirected to the sandbox callback with an authorization code" : `The provider redirected with an error: ${e.params.error ?? "unknown"}`}
        body={<Details>{JSON.stringify(e.params, null, 2)}</Details>} />
    );
  }
  if (e.type !== "item") return null;
  const live = e.phase === "started";
  switch (e.kind) {
    case "search":
      return <Row icon={live ? Loader2 : Search} spin={live} title={<>Searching <span className="text-muted">“{e.query}”</span></>} />;
    case "command":
      return (
        <Row icon={live ? Loader2 : Terminal} spin={live} tone={e.exit && e.exit !== 0 ? "text-amber-500" : undefined}
          title={<code className="font-mono text-xs">{e.command}</code>}
          body={e.output ? <Details>{e.output}</Details> : null} />
      );
    case "tool":
      if (e.server === "ask_user") return null; // rendered as question/authorize cards
      return (
        <Row icon={live ? Loader2 : e.server === "browser" ? MousePointer2 : Globe} spin={live}
          title={<><span className="font-medium">{e.server}</span>.{e.tool} <span className="font-mono text-xs text-muted">{e.args}</span></>}
          body={e.result || e.error ? <Details>{e.error ?? e.result}</Details> : null} />
      );
    case "reasoning":
      return <Row icon={Brain} title={<span className="text-muted italic">{e.text}</span>} />;
    case "message":
      return <Row icon={MessageSquare} tone="text-ink" title={e.text} />;
    case "todo":
      return (
        <Row icon={CheckCircle2} title="Plan" body={
          <ul className="mt-1 space-y-0.5 text-xs text-muted">
            {e.items?.map((t) => <li key={t.text} className={t.completed ? "line-through" : ""}>• {t.text}</li>)}
          </ul>
        } />
      );
    default:
      return null;
  }
}

function QuestionCard({ q, runId, answer }: { q: Extract<Ev, { type: "question" }>; runId: string; answer?: string }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const final = answer ?? sent;

  async function reply(v: string) {
    if (!v.trim()) return;
    setSending(true);
    await fetch(`/api/runs/${runId}/answer`, { method: "POST", body: JSON.stringify({ qid: q.qid, text: v }) });
    setSending(false);
    setSent(v);
  }

  return (
    <div className="my-2 rounded-2xl border-2 border-accent/40 bg-accent/5 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold"><MessageSquare className="size-4 text-accent" /> The agent needs you</div>
      <p className="mt-2 text-sm font-medium">{q.question}</p>
      {q.context && <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted">{q.context}</p>}
      {final ? (
        <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm"><span className="text-muted">You: </span>{final}</p>
      ) : (
        <>
          <form onSubmit={(e) => { e.preventDefault(); reply(text); }} className="mt-3 flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Reply, or paste a client_id. Never paste secrets or passwords."
              className="h-10 flex-1 rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:ring-2 focus:ring-accent/30"
            />
            <button disabled={sending} className="grid size-10 place-items-center rounded-lg bg-accent text-white disabled:opacity-50">
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </button>
          </form>
          <div className="mt-2 flex flex-wrap gap-2">
            {[...new Set([...q.options, "skip"])].map((o) => (
              <button key={o} onClick={() => reply(o)} className="rounded-full border border-line bg-surface px-3 py-1 text-xs hover:border-accent">{o === "skip" ? "Skip → research-only guide" : o}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AuthorizeCard({ a, runId, answer }: { a: Extract<Ev, { type: "authorize" }>; runId: string; answer?: string }) {
  const [text, setText] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const final = answer ?? sent;
  async function reply(v: string) {
    if (!v.trim()) return;
    await fetch(`/api/runs/${runId}/answer`, { method: "POST", body: JSON.stringify({ qid: a.qid, text: v }) });
    setSent(v);
  }
  return (
    <div className="my-2 rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/5 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="size-4 text-emerald-600" /> Authorize in your browser</div>
      <p className="mt-1.5 text-sm text-muted">
        {a.instructions || "Open the link while signed in to the provider and approve. The provider redirects to a temporary callback in the agent's sandbox, which proves your client_id, redirect URI and scopes work. Nothing secret is shared."}
      </p>
      {final ? (
        <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm"><span className="text-muted">Result: </span>{final}</p>
      ) : (
        <>
          <a href={a.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            Open authorize URL <ExternalLink className="size-4" />
          </a>
          <code className="mt-2 block truncate font-mono text-[11px] text-muted">{a.url}</code>
          <form onSubmit={(e) => { e.preventDefault(); reply(text); }} className="mt-3 flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Saw an error page instead? Describe it here."
              className="h-10 flex-1 rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30" />
            <button className="grid size-10 place-items-center rounded-lg bg-ink text-bg"><Send className="size-4" /></button>
          </form>
          <button onClick={() => reply("skip")} className="mt-2 rounded-full border border-line bg-surface px-3 py-1 text-xs">Skip this check</button>
        </>
      )}
    </div>
  );
}
