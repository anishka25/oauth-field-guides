// OAuth redirect target, exposed publicly through a Modal encrypted tunnel.
// Records each /callback hit for the agent (full params in /work/callbacks/)
// and streams a redacted copy to the browser (the code is one-time but still
// not something to display).
import fs from "node:fs";
import http from "node:http";

const W = "/work";
const PORT = Number(process.env.CALLBACK_PORT ?? 8976);
fs.mkdirSync(`${W}/callbacks`, { recursive: true });
const event = (o) => fs.appendFileSync(`${W}/events.jsonl`, JSON.stringify({ t: Date.now(), ...o }) + "\n");

const page = (title, body) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${title}</title><body style="font:16px system-ui;max-width:520px;margin:15vh auto;padding:0 16px;color:#18181b">
<h1 style="font-size:22px">${title}</h1><p style="color:#71717a">${body}</p></body>`;

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    if (url.pathname !== "/callback") {
      res.writeHead(404).end("not found");
      return;
    }
    const params = Object.fromEntries(url.searchParams);
    fs.writeFileSync(`${W}/callbacks/${Date.now()}.json`, JSON.stringify({ at: new Date().toISOString(), params }));
    const redacted = Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, k === "code" ? `<${v.length} chars>` : v.slice(0, 200)]),
    );
    event({ type: "callback", params: redacted });
    const ok = "code" in params;
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(
      ok
        ? page("Callback received ✓", "The agent got the provider's redirect. You can close this tab and return to the guide.")
        : page("The provider returned an error", `${params.error ?? "unknown"}: ${params.error_description ?? ""}. The agent will record this in the guide.`),
    );
  })
  .listen(PORT, "0.0.0.0");
