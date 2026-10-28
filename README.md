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

## Key decisions

- **The wait is the product.** The timeline bar shows hands-on minutes next to review weeks, because the coding is rarely the bottleneck. What blocks developers is CASA, AppExchange review, and Marketplace listings.
- **"Agent vs. you" is explicit.** Almost no provider lets you register an app without logging in, so every guide names the login wall as a human step and lists what the agent can prepare or verify around it.
- **No VNC or remote browser.** It was cut for scope. Logging in through a streamed browser is fragile, and the agent should never handle passwords anyway. The textbox handoff (paste a client_id) gives real evidence with no credential risk.
- **Evidence over prose.** `tested` is reserved for probes actually run (shown in the "What we actually tested" log, with real responses). Review durations without an SLA are always marked `inferred`.
- **Seed set chosen for variety:** GitHub (trivial), Notion (DCR via MCP), Mastodon (anonymous registration, per-instance), Slack (self-serve, optional Marketplace), Salesforce (paid security review), Google/Gmail (restricted scopes and CASA).

## What I verified, corrected, or couldn't verify

Read-only probes (`web/scripts/probe.mjs`) were run against every seed provider on 2026-10-27:

| Finding | Effect on the guide |
|---|---|
| GitHub has **no** OIDC/OAuth discovery doc (404) and redirects a fake client_id to login before validating it | Recorded as a gotcha; an agent can't confirm a GitHub client_id without a session |
| Google rejects a fake client_id **before login** (`authError=invalid_client`) | The agent can validate a pasted client_id from the sandbox, so this became an agent step |
| Salesforce discovery **advertises** `registration_endpoint`, but `POST {}` → **401** (needs an initial access token) | **Correction:** I had assumed DCR was available. Marked `dynamicRegistration: no` and added a gotcha |
| Mastodon uses a non-standard **`app_registration_endpoint`** (not RFC 7591 `registration_endpoint`) | Added a gotcha; generic DCR clients would miss it |
| Notion's MCP server exposes real DCR (`/register`, S256); `api.notion.com` has no discovery (400) | Two separate paths documented |
| Slack's OIDC discovery only covers "Sign in with Slack", not the bot `oauth/v2` flow | Gotcha added |
| Self-review: Gmail summary said "read and send scopes are restricted" | **Corrected:** `gmail.send` is *sensitive*; only read/modify are restricted |

**Not verified:** review durations (Google, Salesforce, Slack Marketplace, GitHub Marketplace) come from community reports and are marked `inferred`. CASA and security-review costs weren't priced. I didn't run a full authorization-code flow with real accounts, so the curated guides are `research-only`. I also didn't POST to registration endpoints that would create real clients.

## Limitations

- 6 curated guides, not 100. The schema and agent are built so the rest can be generated and then reviewed by a human.
- Generated guides are saved to `web/data/generated` locally. On Vercel, set the Upstash env vars, because its filesystem is read-only.
- No auth or rate limiting on `/api/runs`. Each run starts a sandbox and uses OpenAI tokens.
- The agent's quality depends on the model and on how well each provider's docs are indexed. Generated guides are labeled as agent-generated and research-only unless a hands-on check ran.
- No credentials are in the repo. Keys come from `.env.local` or Modal Secrets.
