# OAuth Field Guides

Before an agent's users can connect an app, the developer has to register an **OAuth app** with that provider (client_id/secret, redirect URIs, scopes). Sometimes they also have to get it **approved**. This project answers the questions developers actually have: *Will this take an hour or six weeks? What will block approval? What can an agent do for me, and where do I take over?*

- **Library** (`/`): curated guides with fuzzy search over names, scopes and gotchas, plus filters (self-serve, needs review, dynamic registration, agent-generated).
- **Guide page** (`/guides/[slug]`): shareable. Each kind of information has its own component: verdict and difficulty meter, a timeline that separates hands-on work from review wait, an agent vs. you split, a stepper with actor badges and copyable values, a requirements checklist, a scope-tier table, a technical spec, "if you get stuck" accordions, nuance callouts, a log of what was tested, an "unverified" panel, and numbered sources.
- **Live generation** (`/generate`): enter any app name or URL. A Codex agent runs in a Modal sandbox, streams its activity, asks you questions in a textbox, and saves a new shareable guide.

## Setup

```bash
cd web
npm install
cp .env.example .env.local   # fill in OPENAI_API_KEY (+ Modal token unless ~/.modal.toml exists)
npm run dev                  # http://localhost:3000
```

You don't need Docker. The sandbox image is defined in code (`web/src/lib/sandbox.ts`) and built by Modal's image builder on the first run, which takes about 1 minute; after that it's cached. To check the sandbox toolchain without an OpenAI key:

```bash
npx tsx --conditions=react-server scripts/smoke-sandbox.mts
```

## How live generation works

```
browser ──POST /api/runs──▶ Next route ──Modal JS SDK──▶ Sandbox (node:22 + Codex CLI + Playwright/Chromium)
        ◀──SSE /events───  tail -F /work/events.jsonl  ◀── runner.mjs (Codex SDK runStreamed)
        ──POST /answer──▶  writes /work/answers/<qid>.txt ──▶ ask_user MCP tool unblocks
```

- **Codex SDK** (`@openai/codex-sdk`) runs *inside* the sandbox with live web search, a shell (curl probes) and two MCP servers: **Playwright MCP** (headless Chromium) and **`ask_user`**.
- **`ask_user`** is a small custom stdio MCP server (`web/sandbox/ask-user-mcp.mjs`). I checked first: the TS SDK (0.164) wraps `codex exec` and exposes no `request_user_input` / server-request channel, so a tool that blocks on a file the web app writes was the cleanest bridge.
- **The run is stateless:** the sandbox ID is the run ID. Reconnecting replays the event log. On `end`, the guide is validated against the zod schema, saved, and the sandbox is terminated.
- **The same zod schema** (`web/src/lib/schema.ts`) validates curated JSON, renders the UI, and is converted to the strict `outputSchema` for Codex's final turn.

### Agent phases
1. **Research:** official docs, developer portal, scopes, review and marketplace rules.
2. **Probe (read-only):** fetch `/.well-known/oauth-authorization-server` and `openid-configuration`, call the authorize endpoint with a fake client_id, and check whether a registration endpoint needs auth.
3. **Ask:** offer a hands-on test. The developer signs in and creates the app **in their own browser**, then pastes back the client_id (never secrets).
4. **Hands-on:** probe the client_id from the sandbox, then run a **real authorize flow**. The sandbox exposes a public HTTPS callback through a Modal encrypted tunnel (`callback-server.mjs`). The developer adds it as a redirect URI and clicks "Open authorize URL" in their own logged-in browser. The provider then redirects back into the sandbox, which proves the client_id, redirect URI and scopes work, with no secrets shared. If the provider allows public-client PKCE, the agent also exchanges the code and records the token lifetime and whether there's a refresh token (never the values). This matters for providers like GitHub and Linear that only validate a client after login, where probing from the sandbox alone can't confirm anything.
5. **Write the guide:** every claim is tagged `tested` / `sourced` / `inferred`; `mode` is `hands-on` or `research-only`.

## Limitations

- 6 curated guides, not 100. The schema and agent are built so the rest can be generated and then reviewed by a human.
- Generated guides are saved to `web/data/generated` locally. On Vercel, set the Upstash env vars, because its filesystem is read-only.
- No auth or rate limiting on `/api/runs`. Each run starts a sandbox and uses OpenAI tokens.
- The agent's quality depends on the model and on how well each provider's docs are indexed. Generated guides are labeled as agent-generated and research-only unless a hands-on check ran.
- No credentials are in the repo. Keys come from `.env.local` or Modal Secrets.
