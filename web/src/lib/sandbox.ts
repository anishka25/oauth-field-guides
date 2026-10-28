import "server-only";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ModalClient, type Sandbox } from "modal";
import { guideJsonSchema } from "./schema";

// Credentials: MODAL_TOKEN_ID / MODAL_TOKEN_SECRET env vars, or ~/.modal.toml.
export const modal = new ModalClient();
const APP_NAME = "oauth-field-guides";
const CALLBACK_PORT = 8976;

const b64 = (f: string) => fs.readFileSync(path.join(process.cwd(), "sandbox", f)).toString("base64");

// Built by Modal's image builder; no local Docker. Layers are cached, so only
// the last layer (agent sources) rebuilds when the agent code changes.
export function image() {
  return modal.images
    .fromRegistry("node:22-bookworm-slim")
    .dockerfileCommands([
      "RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*",
      "WORKDIR /app",
      "RUN npm init -y >/dev/null && npm i @openai/codex-sdk@0.164.0 @playwright/mcp@0.0.83",
      "RUN npx playwright install --with-deps chromium",
      "RUN mkdir -p /work/answers",
    ])
    .dockerfileCommands([
      `RUN echo ${b64("runner.mjs")} | base64 -d > /app/runner.mjs`,
      `RUN echo ${b64("ask-user-mcp.mjs")} | base64 -d > /app/ask-user-mcp.mjs`,
      `RUN echo ${b64("callback-server.mjs")} | base64 -d > /app/callback-server.mjs`,
    ]);
}

// Auth, in order: OPENAI_API_KEY, a named Modal Secret, or a ChatGPT-subscription
// login (`codex login`), whose auth.json is copied into the sandbox at run time
// (never baked into the image). CODEX_AUTH_JSON_B64 lets hosted deploys do the same.
async function openaiSecrets() {
  if (process.env.OPENAI_API_KEY) return [await modal.secrets.fromObject({ OPENAI_API_KEY: process.env.OPENAI_API_KEY })];
  if (process.env.MODAL_OPENAI_SECRET) return [await modal.secrets.fromName(process.env.MODAL_OPENAI_SECRET)];
  return [];
}

function chatgptAuth(): string | null {
  if (process.env.OPENAI_API_KEY || process.env.MODAL_OPENAI_SECRET) return null;
  if (process.env.CODEX_AUTH_JSON_B64) return Buffer.from(process.env.CODEX_AUTH_JSON_B64, "base64").toString("utf8");
  const f = path.join(process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex"), "auth.json");
  return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null;
}

export async function startRun(appName: string) {
  const app = await modal.apps.fromName(APP_NAME, { createIfMissing: true });
  const sb = await modal.sandboxes.create(app, image(), {
    timeoutMs: 45 * 60 * 1000,
    cpu: 2,
    memoryMiB: 4096,
    // Public HTTPS URL for OAuth redirects, so a developer can finish a real
    // authorize flow in their own browser and land the code in the sandbox.
    encryptedPorts: [CALLBACK_PORT],
    secrets: await openaiSecrets(),
    env: process.env.CODEX_MODEL ? { CODEX_MODEL: process.env.CODEX_MODEL } : {},
  });
  const auth = chatgptAuth();
  if (auth) {
    await sb.exec(["mkdir", "-p", "/root/.codex"]);
    await sb.filesystem.writeText(auth, "/root/.codex/auth.json");
  } else if (!process.env.OPENAI_API_KEY && !process.env.MODAL_OPENAI_SECRET) {
    await sb.terminate();
    throw new Error("No Codex auth: run `codex login` (ChatGPT), or set OPENAI_API_KEY / MODAL_OPENAI_SECRET");
  }
  const callbackUrl = `${(await sb.tunnels())[CALLBACK_PORT].url}/callback`;
  await sb.filesystem.writeText(JSON.stringify({ app: appName, callbackUrl, schema: guideJsonSchema() }), "/work/input.json");
  await sb.filesystem.writeText("", "/work/events.jsonl");
  await sb.exec(["sh", "-c", `CALLBACK_PORT=${CALLBACK_PORT} nohup node /app/callback-server.mjs > /work/callback.log 2>&1 &`]);
  await sb.exec(["sh", "-c", "cd /work && nohup node /app/runner.mjs > /work/runner.log 2>&1 &"]);
  return sb.sandboxId;
}

export async function getSandbox(id: string): Promise<Sandbox> {
  if (!/^sb-[A-Za-z0-9-]+$/.test(id)) throw new Error("bad run id");
  return modal.sandboxes.fromId(id);
}

export async function answer(id: string, qid: string, text: string) {
  if (!/^q[a-z0-9]+$/.test(qid)) throw new Error("bad question id");
  const sb = await getSandbox(id);
  await sb.filesystem.writeText(text.slice(0, 4000), `/work/answers/${qid}.txt`);
}

/** Streams events.jsonl lines from the start (so reconnects replay history). */
export async function* tailEvents(id: string, signal: AbortSignal) {
  const sb = await getSandbox(id);
  const proc = await sb.exec(["tail", "-n", "+1", "-F", "/work/events.jsonl"]);
  const reader = proc.stdout.getReader();
  signal.addEventListener("abort", () => reader.cancel().catch(() => {}));
  let buf = "";
  while (!signal.aborted) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) yield line;
    }
  }
}

export async function stopRun(id: string) {
  await (await getSandbox(id)).terminate().catch(() => {});
}
