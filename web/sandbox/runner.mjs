// Runs inside the Modal sandbox. Drives a Codex agent and appends compact
// events to /work/events.jsonl, which the web app tails and streams as SSE.
import { Codex } from "@openai/codex-sdk";
import fs from "node:fs";

const W = "/work";
const event = (o) => fs.appendFileSync(`${W}/events.jsonl`, JSON.stringify({ t: Date.now(), ...o }) + "\n");
const input = JSON.parse(fs.readFileSync(`${W}/input.json`, "utf8"));
const today = new Date().toISOString().slice(0, 10);

const PROMPT = `You are an OAuth integration researcher. A developer building an AI agent wants their users to connect "${input.app}". Find out what it takes to create and get approved an OAuth app with this provider, and write a guide they can follow.

Tools: web search, a shell with curl (use it for HTTP probes), a headless browser (playwright MCP; use it sparingly, e.g. to see what the developer portal shows before login), and ask_user (talks to the developer).

Work in phases. Before each phase, write one short sentence saying what you're doing.

1. RESEARCH (always). Find the official OAuth docs, the developer portal / app registration page, scope list, and any app review, verification, marketplace or partner requirements. Prefer official docs. Note each URL you rely on.
2. PROBE (always, read-only). With curl:
   - GET /.well-known/oauth-authorization-server and /.well-known/openid-configuration on the auth host(s). Record authorize/token URLs, PKCE methods, registration_endpoint.
   - GET the authorize URL with a fake client_id (redirects not followed) and record what happens: an invalid_client error before login, or a redirect to login.
   - If a registration_endpoint exists, you may check whether it requires auth by POSTing {} (do NOT register a real client).
   - Record each probe in "tested" with the actual result.
3. ASK. You MUST invoke the ask_user MCP tool here. Writing the question as a normal message does NOT reach the developer, and you'd get no reply. Call ask_user once to offer a hands-on test and wait for its result. In 'context', explain exactly where to go and what to enter: app name, minimal scopes, and this redirect URI, a live public callback inside your sandbox: ${input.callbackUrl}. Ask them to paste back the client_id and any notable form fields or requirements they saw, or reply "skip". Offer options like ["I pasted the client_id above", "skip"]. Never ask for passwords, client secrets or tokens.
4. HANDS-ON (only if they gave a client_id).
   a. Probe from the sandbox first: authorize URL with their client_id. Some providers reject bad clients before login, which is evidence by itself.
   b. Then run the real flow: build the authorize URL (their client_id, redirect_uri=${input.callbackUrl}, minimal scopes, a random state, and a PKCE S256 challenge if supported; keep the verifier) and call request_authorization. The developer opens it in their own logged-in browser and approves; the provider redirects to your callback.
   c. If it redirected with a code: client_id, redirect URI and scopes are verified (tested). If the provider supports PKCE without a secret (public client), try the token exchange with the verifier and record token_type, expires_in, refresh_token presence and returned scopes, never the token values. If the exchange needs a client secret, stop there and note it; don't ask for the secret.
   d. If it redirected with an error, or the user reports an error page (e.g. redirect URI rejected, domain must be verified), that's a real finding. Record it in "tested" and in blockers.
   e. Remind the developer in your final step list to remove the temporary sandbox redirect URI from their app. If they pasted something that looks like a secret, don't repeat it anywhere.
5. WRITE THE GUIDE as your final message: JSON only, matching the output schema.
   - origin="agent"; mode="hands-on" only if step 4 ran, else "research-only"; lastVerified="${today}"; slug=kebab-case of the app name.
   - difficulty: 1 self-serve minutes, no review · 2 self-serve but distribution needs light steps · 3 review of days · 4 paid/security review of weeks · 5 partner-gated, restricted, or months.
   - steps: ordered, each with actor agent|human|wait and a realistic duration. Be explicit about the login wall (a human step).
   - evidence on each claim: "tested" only for what you actually probed; "sourced" with sourceIds pointing to sources[]; otherwise "inferred". Never inflate.
   - Put anything you couldn't confirm into uncertainties. Put review durations without an official SLA under inferred.
   - Be concrete and concise. No marketing language.`;

const codex = new Codex({
  apiKey: process.env.OPENAI_API_KEY || undefined, // unset → ~/.codex/auth.json (ChatGPT login)
  config: {
    mcp_servers: {
      browser: {
        command: "/app/node_modules/.bin/playwright-mcp",
        args: ["--headless", "--isolated", "--no-sandbox", "--browser", "chromium"],
        startup_timeout_sec: 60,
        tool_timeout_sec: 120,
      },
      ask_user: { command: "node", args: ["/app/ask-user-mcp.mjs"], tool_timeout_sec: 1000 },
    },
  },
});

const thread = codex.startThread({
  model: process.env.CODEX_MODEL || undefined,
  workingDirectory: W,
  skipGitRepoCheck: true,
  sandboxMode: "danger-full-access", // the Modal sandbox is the isolation boundary
  approvalPolicy: "never",
  networkAccessEnabled: true,
  webSearchMode: "live",
  modelReasoningEffort: "medium",
});

const clip = (s, n = 1200) => (typeof s === "string" && s.length > n ? s.slice(0, n) + "…" : s);

function compact(item) {
  switch (item.type) {
    case "command_execution":
      return { kind: "command", command: clip(item.command, 300), output: clip(item.aggregated_output), exit: item.exit_code, status: item.status };
    case "mcp_tool_call": {
      const text = (item.result?.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
      return { kind: "tool", server: item.server, tool: item.tool, args: clip(JSON.stringify(item.arguments ?? {}), 400), result: clip(text, 800), error: item.error?.message, status: item.status };
    }
    case "web_search":
      return { kind: "search", query: item.query };
    case "reasoning":
      return { kind: "reasoning", text: clip(item.text, 800) };
    case "agent_message":
      return { kind: "message", text: item.text };
    case "todo_list":
      return { kind: "todo", items: item.items };
    case "error":
      return { kind: "error", text: item.message };
    default:
      return { kind: item.type };
  }
}

async function turn(prompt, schema) {
  const { events } = await thread.runStreamed(prompt, { outputSchema: schema });
  let final = "";
  for await (const e of events) {
    if (e.type === "item.started" || e.type === "item.completed" || e.type === "item.updated") {
      if (e.type === "item.updated" && e.item.type !== "todo_list") continue;
      const c = compact(e.item);
      if (e.item.type === "agent_message" && e.type === "item.completed") final = e.item.text;
      // The final JSON is sent as the guide, not as a chat message.
      if (c.kind === "message" && final && final.trim().startsWith("{")) continue;
      event({ type: "item", phase: e.type.split(".")[1], id: e.item.id, ...c });
    } else if (e.type === "turn.completed") {
      event({ type: "usage", usage: e.usage });
    } else if (e.type === "turn.failed") {
      throw new Error(e.error?.message ?? "turn failed");
    } else if (e.type === "error") {
      throw new Error(e.message);
    }
  }
  return final;
}

try {
  event({ type: "status", text: `Agent started for "${input.app}" on ${process.env.CODEX_MODEL || "Codex default model"}` });
  let out = await turn(PROMPT, input.schema);
  let guide;
  try { guide = JSON.parse(out); } catch {
    event({ type: "status", text: "Formatting the guide…" });
    out = await turn("Now output the final guide as JSON matching the schema. JSON only.", input.schema);
    guide = JSON.parse(out);
  }
  fs.writeFileSync(`${W}/guide.json`, JSON.stringify(guide));
  event({ type: "guide", guide });
} catch (err) {
  event({ type: "error", text: String(err?.message ?? err) });
} finally {
  event({ type: "end" });
}
