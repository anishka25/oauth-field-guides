# OAuth Setup Guides — Build Plan

## 1. Product shape

- **Library** (`/`): search and filter over curated guides.
- **Guide page** (`/guides/[slug]`): a shareable URL. The page is made of typed UI components, one component per kind of information.
- **Live generation** (`/generate`): the user enters an app name or URL. An agent runs in a Modal sandbox and streams its progress. It asks the user questions when it needs authentication. The result is a new guide at its own shareable URL.

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 15 (App Router) + Tailwind v4 + shadcn/ui + lucide icons | Fast, tasteful defaults, and SSR gives shareable pages |
| Search | Fuse.js over name, aliases, category and tags, plus facet filters (difficulty, review required, DCR, agent can complete) | 100 guides fit in the client; no search service needed |
| Guide data | One JSON file per guide, validated by a **zod schema** shared by the UI, the agent output and the tests | One contract everywhere |
| Generated guides | Stored in Upstash Redis or Vercel KV (fallback: the filesystem) | Shareable URLs for live results |
| Agent | **Codex SDK (TypeScript, `@openai/codex-sdk`)**, running *inside* the Modal sandbox | See section 4 |
| Sandbox | **Modal Sandbox** from a prebuilt image (`Image.from_name`) | Isolated, with a browser inside |
| Browser | Playwright Chromium + **Playwright MCP** (agent control) + Xvfb/noVNC (live view for the user) | Agent drives the browser, and the human takes over for login |
| Hosting | Vercel (web) + Modal (sandboxes and a small orchestrator web endpoint) | |

## 3. Guide schema → UI component mapping

Every claim has an `evidence` field: `tested` (with a timestamp and a screenshot or response), `sourced` (with a URL) or `inferred`.

| Schema block | UI component |
|---|---|
| `verdict` (difficulty 1–5, one-line summary) | **Verdict hero**: a colored difficulty meter and a "ready in ~X" headline |
| `timeline` (self-serve minutes vs. review wait in days or weeks) | **Timeline bar**: work segments vs. wait segments, visually distinct |
| `steps[]` (`actor: agent \| human \| wait`) | **Stepper** with actor badges (🤖 / 👤 / ⏳), copyable values (redirect URI, scopes) |
| `requirements[]` | **Checklist cards**: domain, privacy policy, paid plan, company info |
| `scopes[]` (tier: basic / sensitive / restricted) | **Scope table** with tier chips; restricted scopes trigger a warning |
| `blockers[]` (symptom → fix) | **Callout accordions** in amber/red |
| `gotchas[]` | **Inline "nuance" callouts** |
| `endpoints` (auth, token, PKCE, DCR, refresh behavior) | **Tech spec panel**, monospace, with copy buttons |
| `agentVsHuman` | **Split card**: "Agent can do" vs. "You take over" |
| `evidence[]` | **Source footnotes** and an evidence legend; a "Tested on <date>" badge |
| `uncertainties[]` | **Muted "unverified" panel** |

Design language: neutral zinc palette, one accent color. Difficulty uses green → amber → red. Inter and JetBrains Mono fonts, generous whitespace, dark mode included.

## 4. Live agent architecture (revised)

> **Revision:** no VNC. The agent asks questions in a normal chat textbox. The user does any logged-in steps in their own browser and pastes back **non-secret** results, such as the `client_id` they created, the form fields they saw, or "done/skip". The agent then *tests* those results from the sandbox: it probes the authorize URL with the real client_id and checks how the redirect URI and scopes are handled. We use Codex's native `request_user_input` if the TS SDK exposes it. Otherwise we use a custom `ask_user` MCP tool. No Docker: the sandbox image is built with Modal's image builder (`images.fromRegistry(playwright base).dockerfileCommands([...])`), and the runner source is baked in.
>
> **Run transport (stateless):** `POST /api/runs` creates the sandbox and starts the runner in the background, and the sandbox ID becomes the run ID. `GET /api/runs/:id/events` runs `tail -f events.jsonl` in the sandbox and streams it as SSE. `POST /api/runs/:id/answer` writes `answers/<qid>.json` into the sandbox. No tunnels and no ports.

### Original sketch (superseded where it conflicts)

```
Browser (Next.js)
  │  POST /api/runs {app}          ← creates a run
  │  GET  /api/runs/:id/events     ← SSE stream
  │  POST /api/runs/:id/answer     ← answer to the agent's question
  ▼
Orchestrator (Modal web endpoint or Next route, Modal JS SDK)
  │  modal.sandboxes.create(image, {encryptedPorts:[8080, 6080], secrets:[OPENAI_API_KEY], timeout: 30m})
  ▼
Modal Sandbox
  ├─ runner.ts  (HTTP :8080, guarded by a Sandbox Connect Token)
  │    ├─ Codex SDK thread → thread.runStreamed(prompt) → events re-emitted as SSE
  │    └─ structured output: final turn uses outputSchema = Guide JSON schema
  ├─ MCP servers configured for Codex:
  │    ├─ playwright-mcp     (navigate, click, fill, screenshot, read)
  │    └─ ask-user (custom)  → tool `ask_user({question, kind, options})` blocks
  │                             until POST /answer arrives
  ├─ Chromium on Xvfb  + noVNC :6080 (live view; user logs in here directly)
  └─ web search: Codex built-in web search tool (enabled in config)
```

### Why ask_user is a custom MCP tool
The Codex app server has native approvals (`item/commandExecution/requestApproval`), but they're built for approving commands, not for open-ended questions. A small MCP tool is explicit, works with any Codex version, and maps cleanly to a UI card. (We should check what native user-input support the installed version has, using `codex app-server generate-ts`.)

### Agent phases
1. **Research** (always): web search and fetch the docs, check `/.well-known/oauth-authorization-server` and `openid-configuration`, probe the authorize endpoint with a fake `client_id`, check for a DCR `registration_endpoint`, open the dev portal and screenshot the login wall.
2. **Ask**: call `ask_user`, for example: "The GitHub developer settings need a login. Open the live browser and sign in? [Open browser] [Skip → research-only guide]".
3. **Hands-on** (if accepted): the user signs in **themselves in the noVNC view**, so credentials never go through the agent or our servers. The agent then fills in the app-creation form, records every field and requirement, sets the redirect to the sandbox callback, and runs an auth-code + PKCE flow against a tiny callback server inside the sandbox. It stops before any submit that's irreversible, public or paid, and asks first.
4. **Write guide**: a final turn with `outputSchema`, where every claim is tagged with evidence. The result is validated with zod and saved under a slug.

If the user declines, phase 3 is skipped and the guide is **research-only**: the hands-on steps are marked `inferred` or `sourced`, with a banner explaining that.

### Streamed event → UI mapping
| Codex event | UI |
|---|---|
| `item.started`/`completed` (web_search) | "Searching: …" row with result links |
| mcp_tool_call (playwright) | Browser action row and a screenshot thumbnail |
| mcp_tool_call `ask_user` | **Question card** with buttons, which pauses the timeline |
| agent_message / reasoning | Collapsible "thinking" notes |
| `turn.completed` + final JSON | Guide renders progressively and gets a share link |

### Safety rails (in the system prompt + enforced)
- Never type passwords, never solve CAPTCHAs, never pay, never submit an app for review.
- The sandbox has a network egress allowlist where possible, a 30-minute timeout, and is destroyed at the end of the run. Nothing persists except the guide JSON and the screenshots.
- The OpenAI key comes from a Modal Secret and is never in the repo.

## 5. Seed library (hand-verified)
Pick a variety of setup challenges:
- **GitHub:** easy, self-serve in about 5 minutes (tested).
- **Slack:** moderate; works immediately for your own workspace, the Marketplace needs review.
- **Google Workspace (Gmail):** hard; sensitive or restricted scopes need verification, plus a CASA assessment taking weeks.
- **Notion:** public integration, plus MCP with DCR, so an agent can register it by itself.
- **Salesforce:** Connected App setup, a Dev org required, AppExchange security review.
- **Mastodon:** anonymous app registration through the API; fully agent-completable.

Each gets a fact-check record: what we tested, what we corrected, what we couldn't verify. Those feed the README.

## 6. Milestones (~7h)
1. (1h) Scaffold Next.js, Tailwind and shadcn; zod schema; guide components using a mock guide.
2. (1h) Library page with search and facets; guide page; share/copy.
3. (1.5h) Write and verify 4–6 seed guides.
4. (2h) Modal image (Node, Codex CLI/SDK, Playwright, Xvfb, noVNC), runner, ask-user MCP, SSE.
5. (1h) Generate page: event timeline, question cards, embedded noVNC, progressive guide.
6. (0.5h) README: decisions, evidence, limitations; deploy.

## 7. Open questions / risks
- Check the exact Codex SDK streaming event names and the MCP and web-search config keys for the installed version, using `generate-ts` and the config docs.
- Embedding noVNC needs the connect-token query param on a `wss://` URL. Test early.
- Cold start of a browser image: pre-warm one sandbox or accept about 10–20 seconds.
