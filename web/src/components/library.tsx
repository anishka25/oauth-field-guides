"use client";
import Fuse from "fuse.js";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Bot, Hourglass, Search, Sparkles } from "lucide-react";
import type { Guide } from "@/lib/schema";
import { AppIcon } from "./app-icon";
import { DifficultyMeter, diffStyle, setupLabel, waitLabel } from "./guide";

type Facet = "all" | "easy" | "review" | "agent" | "dcr";
const FACETS: { id: Facet; label: string; test: (g: Guide) => boolean }[] = [
  { id: "all", label: "All", test: () => true },
  { id: "easy", label: "Self-serve (no review)", test: (g) => g.timeline.approvalWait.unit === "none" },
  { id: "review", label: "Needs review", test: (g) => g.timeline.approvalWait.unit !== "none" },
  { id: "dcr", label: "Dynamic registration", test: (g) => g.endpoints.dynamicRegistration === "yes" },
  { id: "agent", label: "Agent-generated", test: (g) => g.origin === "agent" },
];

export function Library({ guides }: { guides: Guide[] }) {
  const [q, setQ] = useState("");
  const [facet, setFacet] = useState<Facet>("all");
  const fuse = useMemo(
    () =>
      new Fuse(guides, {
        keys: [
          { name: "name", weight: 3 },
          { name: "website", weight: 2 },
          "category",
          "summary",
          "scopes.name",
          "gotchas.title",
        ],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [guides],
  );
  const f = FACETS.find((x) => x.id === facet)!;
  const results = (q.trim() ? fuse.search(q).map((r) => r.item) : guides).filter(f.test);

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search apps, scopes, or gotchas: “gmail”, “marketplace review”, “PKCE”…"
          className="h-14 w-full rounded-2xl border border-line bg-surface pl-12 pr-4 text-base shadow-sm outline-none ring-accent/30 placeholder:text-muted focus:ring-4"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {FACETS.map((x) => (
          <button
            key={x.id}
            onClick={() => setFacet(x.id)}
            className={`rounded-full px-3 py-1 text-sm transition ${facet === x.id ? "bg-ink text-bg" : "border border-line bg-surface text-muted hover:text-ink"}`}
          >
            {x.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((g) => (
          <Link key={g.slug} href={`/guides/${g.slug}`} className="card group flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
              <AppIcon name={g.name} website={g.website} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-semibold">
                  {g.name}
                  {g.origin === "agent" && <Bot className="size-3.5 text-accent" />}
                </div>
                <div className="text-xs text-muted">{g.category}</div>
              </div>
              </div>
              <span className={`text-sm font-medium ${diffStyle(g.verdict.difficulty).t}`}>{g.verdict.label}</span>
            </div>
            <div className="mt-3"><DifficultyMeter value={g.verdict.difficulty} size="sm" /></div>
            <p className="mt-3 line-clamp-2 flex-1 text-sm text-muted">{g.verdict.headline}</p>
            <div className="mt-4 flex items-center gap-3 text-xs text-muted">
              <span>{setupLabel(g)}</span>
              <span className="flex items-center gap-1"><Hourglass className="size-3" />{waitLabel(g)}</span>
              <ArrowRight className="ml-auto size-4 transition group-hover:translate-x-0.5 group-hover:text-ink" />
            </div>
          </Link>
        ))}
        <Link
          href={`/generate${q ? `?app=${encodeURIComponent(q)}` : ""}`}
          className="flex flex-col items-start justify-center rounded-2xl border border-dashed border-line p-5 text-sm text-muted transition hover:border-accent hover:text-ink"
        >
          <Sparkles className="size-5 text-accent" />
          <span className="mt-2 font-medium text-ink">{q ? `No guide for “${q}”?` : "Missing an app?"}</span>
          An agent can research it and write a guide while you watch.
        </Link>
      </div>
    </div>
  );
}
