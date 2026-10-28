// Builds the sandbox image and checks the toolchain inside it (no OpenAI key needed).
import { image, modal } from "../src/lib/sandbox.ts";

const app = await modal.apps.fromName("oauth-field-guides", { createIfMissing: true });
console.time("create");
const sb = await modal.sandboxes.create(app, image(), { timeoutMs: 10 * 60 * 1000 });
console.timeEnd("create");
const run = async (cmd: string) => {
  const p = await sb.exec(["sh", "-c", cmd]);
  console.log(`$ ${cmd}\n${(await p.stdout.readText()).trim()}\n${(await p.stderr.readText()).trim()}`);
};
await run("node -v; ls /app; /app/node_modules/.bin/codex --version");
await run("timeout 20 /app/node_modules/.bin/playwright-mcp --help | head -3");
await run(`mkdir -p /work && touch /work/events.jsonl && printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | timeout 5 node /app/ask-user-mcp.mjs`);
await run(`cd /tmp && node -e "const {chromium}=require('/app/node_modules/playwright');chromium.launch({args:['--no-sandbox']}).then(async b=>{const p=await b.newPage();await p.goto('https://github.com/settings/applications/new');console.log('browser ok:',p.url());await b.close()}).catch(e=>console.log('browser err',e.message))"`);
await sb.terminate();
