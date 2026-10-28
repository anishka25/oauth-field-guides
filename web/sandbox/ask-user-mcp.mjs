// Minimal stdio MCP server exposing `ask_user` and `request_authorization`.
// Codex's TS SDK has no request_user_input channel, so the tool writes a
// question event to /work/events.jsonl (streamed to the browser) and blocks
// until the web app drops /work/answers/<qid>.txt into the sandbox.
import fs from "node:fs";
import readline from "node:readline";

const W = "/work";
const TIMEOUT_MS = 15 * 60 * 1000;
const send = (m) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...m }) + "\n");
const event = (o) => fs.appendFileSync(`${W}/events.jsonl`, JSON.stringify({ t: Date.now(), ...o }) + "\n");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TOOL = {
  name: "ask_user",
  description:
    "Ask the developer a question and wait for their reply. Use it when you need something only they can do or know: signing in to the provider, creating the app in its dashboard, or pasting a NON-SECRET value such as a client_id or the field labels they see. Never ask for passwords, client secrets, API keys or tokens. The reply may be 'skip', which means continue research-only.",
  inputSchema: {
    type: "object",
    properties: {
      question: { type: "string", description: "Short, concrete question or instruction." },
      context: { type: "string", description: "Why you're asking, and exact steps/URLs/values they should use." },
      options: { type: "array", items: { type: "string" }, description: "Optional quick-reply buttons, e.g. ['I created it', 'skip']." },
    },
    required: ["question"],
  },
};

async function ask(args) {
  const qid = `q${Date.now().toString(36)}`;
  fs.mkdirSync(`${W}/answers`, { recursive: true });
  event({ type: "question", qid, question: args.question, context: args.context ?? "", options: args.options ?? [] });
  const file = `${W}/answers/${qid}.txt`;
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (fs.existsSync(file)) {
      const answer = fs.readFileSync(file, "utf8").trim();
      event({ type: "answer", qid, answer });
      return answer || "skip";
    }
    await sleep(1000);
  }
  event({ type: "answer", qid, answer: "(no reply, timed out)" });
  return "The user did not reply in time. Treat this as 'skip' and continue research-only.";
}

const AUTH_TOOL = {
  name: "request_authorization",
  description:
    "Show the developer a button that opens an OAuth authorize URL in THEIR OWN logged-in browser, then wait until the provider redirects to the sandbox callback (CALLBACK_URL in /work/input.json). Returns the redirect's query params (code or error, state) so you can verify client_id, redirect URI and scopes end to end. The developer may instead reply 'skip' or describe an error page they saw.",
  inputSchema: {
    type: "object",
    properties: {
      authorize_url: { type: "string", description: "Full authorize URL, using redirect_uri = the sandbox CALLBACK_URL and a random state." },
      expected_state: { type: "string" },
      instructions: { type: "string", description: "One or two lines: what they'll see and what to approve." },
    },
    required: ["authorize_url", "expected_state"],
  },
};

async function authorize(args) {
  const qid = `q${Date.now().toString(36)}`;
  const seen = new Set(fs.existsSync(`${W}/callbacks`) ? fs.readdirSync(`${W}/callbacks`) : []);
  event({ type: "authorize", qid, url: args.authorize_url, instructions: args.instructions ?? "" });
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const fresh = (fs.existsSync(`${W}/callbacks`) ? fs.readdirSync(`${W}/callbacks`) : []).filter((f) => !seen.has(f));
    if (fresh.length) {
      const { params } = JSON.parse(fs.readFileSync(`${W}/callbacks/${fresh.sort().at(-1)}`, "utf8"));
      event({ type: "answer", qid, answer: "(provider redirected to the sandbox)" });
      return JSON.stringify({ redirected: true, state_matches: params.state === args.expected_state, params });
    }
    const ans = `${W}/answers/${qid}.txt`;
    if (fs.existsSync(ans)) {
      const answer = fs.readFileSync(ans, "utf8").trim();
      event({ type: "answer", qid, answer });
      return JSON.stringify({ redirected: false, user_reply: answer });
    }
    await sleep(1000);
  }
  return JSON.stringify({ redirected: false, user_reply: "(timed out)" });
}

readline.createInterface({ input: process.stdin }).on("line", async (line) => {
  let m;
  try { m = JSON.parse(line); } catch { return; }
  if (m.method === "initialize") {
    send({ id: m.id, result: { protocolVersion: m.params?.protocolVersion ?? "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "ask-user", version: "1.0.0" } } });
  } else if (m.method === "tools/list") {
    send({ id: m.id, result: { tools: [TOOL, AUTH_TOOL] } });
  } else if (m.method === "tools/call") {
    const args = m.params?.arguments ?? {};
    const text = m.params?.name === "request_authorization" ? await authorize(args) : `User replied: ${await ask(args)}`;
    send({ id: m.id, result: { content: [{ type: "text", text }] } });
  } else if (m.id !== undefined) {
    send({ id: m.id, result: {} });
  }
});
