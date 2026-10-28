// Tunnel + callback + request_authorization check, without running the agent.
import { image, modal } from "../src/lib/sandbox.ts";

const app = await modal.apps.fromName("oauth-field-guides", { createIfMissing: true });
const sb = await modal.sandboxes.create(app, image(), { timeoutMs: 5 * 60 * 1000, encryptedPorts: [8976] });
const sh = async (c: string) => { const p = await sb.exec(["sh", "-c", c]); return (await p.stdout.readText()).trim() + (await p.stderr.readText()).trim(); };
try {
  const url = (await sb.tunnels())[8976].url;
  console.log("tunnel:", url);
  await sh("mkdir -p /work && touch /work/events.jsonl && (CALLBACK_PORT=8976 nohup node /app/callback-server.mjs >/work/cb.log 2>&1 &)");
  // MCP: call request_authorization, then simulate the provider redirect from outside.
  const mcp = sb.exec(["sh", "-c", `printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"request_authorization","arguments":{"authorize_url":"https://example.com/auth","expected_state":"st123"}}}' | (cat; sleep 20) | timeout 25 node /app/ask-user-mcp.mjs`]);
  await new Promise((r) => setTimeout(r, 4000));
  for (let i = 0; i < 10; i++) {
    const r = await fetch(`${url}/callback?code=fakecode123&state=st123`).catch((e) => ({ status: String(e) }) as Response);
    console.log("GET callback ->", r.status);
    if (r.status === 200) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log("404 path ->", (await fetch(`${url}/other`)).status);
  const out = await (await mcp).stdout.readText();
  console.log("tool result:", out.split("\n").find((l) => l.includes('"id":2'))?.slice(0, 300));
  console.log("events:\n" + (await sh("cat /work/events.jsonl")));
} finally {
  await sb.terminate();
}
