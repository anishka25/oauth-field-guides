import { z } from "zod";

// Every field is required (nullable where optional) so the same schema can be
// passed to Codex as a strict structured-output `outputSchema`.

export const Evidence = z.strictObject({
  kind: z.enum(["tested", "sourced", "inferred"]),
  sourceIds: z.array(z.string()).describe("ids from guide.sources"),
  note: z.string().describe("one line: what was checked or why this is inferred"),
});

const Range = z.strictObject({ min: z.number(), max: z.number() });

export const Guide = z.strictObject({
  slug: z.string().describe("kebab-case, e.g. 'github'"),
  name: z.string(),
  website: z.string(),
  category: z.string().describe("e.g. 'Developer tools', 'CRM', 'Productivity'"),
  summary: z.string().describe("2 sentences: what setup involves and the biggest risk"),
  origin: z.enum(["curated", "agent"]),
  mode: z.enum(["hands-on", "research-only"]),
  lastVerified: z.string().describe("ISO date"),
  verdict: z.strictObject({
    difficulty: z.number().int().min(1).max(5).describe("1 trivial self-serve ... 5 partner-gated / months"),
    label: z.enum(["Easy", "Moderate", "Involved", "Hard", "Gated"]),
    headline: z.string().describe("e.g. 'Self-serve in 10 minutes; review only for public listing'"),
  }),
  timeline: z.strictObject({
    setupMinutes: Range,
    approvalWait: z.strictObject({
      min: z.number(),
      max: z.number(),
      unit: z.enum(["none", "days", "weeks"]),
      appliesWhen: z.string().describe("when the wait applies, e.g. 'only to publish to Marketplace'"),
    }),
    summary: z.string(),
  }),
  agentVsHuman: z.strictObject({
    agent: z.array(z.string()).describe("things an agent can do or prepare"),
    human: z.array(z.string()).describe("things the developer must do (login, legal, payment, review)"),
  }),
  steps: z.array(
    z.strictObject({
      title: z.string(),
      detail: z.string(),
      actor: z.enum(["agent", "human", "wait"]),
      duration: z.string(),
      url: z.string().nullable(),
      copyables: z.array(z.strictObject({ label: z.string(), value: z.string() })),
      evidence: Evidence,
    }),
  ),
  requirements: z.array(
    z.strictObject({
      item: z.string(),
      required: z.enum(["required", "conditional", "optional"]),
      note: z.string(),
      evidence: Evidence,
    }),
  ),
  scopes: z.array(
    z.strictObject({
      name: z.string(),
      tier: z.enum(["basic", "sensitive", "restricted"]),
      purpose: z.string(),
    }),
  ),
  endpoints: z.strictObject({
    authorizeUrl: z.string().nullable(),
    tokenUrl: z.string().nullable(),
    discoveryUrl: z.string().nullable(),
    pkce: z.enum(["required", "supported", "unsupported", "unknown"]),
    dynamicRegistration: z.enum(["yes", "no", "unknown"]),
    refreshTokens: z.string(),
    tokenLifetime: z.string(),
    evidence: Evidence,
  }),
  blockers: z.array(
    z.strictObject({ symptom: z.string(), cause: z.string(), fix: z.string() }),
  ),
  gotchas: z.array(
    z.strictObject({
      title: z.string(),
      detail: z.string(),
      severity: z.enum(["info", "warn", "critical"]),
    }),
  ),
  tested: z.array(
    z.strictObject({
      check: z.string(),
      result: z.string(),
      outcome: z.enum(["pass", "fail", "blocked"]),
    }),
  ),
  uncertainties: z.array(z.string()),
  sources: z.array(z.strictObject({ id: z.string(), title: z.string(), url: z.string() })),
});

export type Guide = z.infer<typeof Guide>;
export type Evidence = z.infer<typeof Evidence>;

export function guideJsonSchema() {
  const s = z.toJSONSchema(Guide, { target: "draft-7" }) as Record<string, unknown>;
  delete s.$schema;
  return s;
}
