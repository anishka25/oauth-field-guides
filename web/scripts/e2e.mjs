import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
// Drives one live run through the HTTP API, auto-answering questions with "skip".
const base = process.env.BASE ?? "http://localhost:3000", app = process.argv[2] ?? "Linear";
// Unlock with ACCESS_CODE from web/.env.local, then reuse the cookie.
const env = Object.fromEntries(require("node:fs").readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const u = await fetch(`${base}/api/unlock`, { method: "POST", body: JSON.stringify({ code: env.ACCESS_CODE }) });
const headers = { cookie: (u.headers.get("set-cookie") ?? "").split(";")[0] };
const r = await fetch(`${base}/api/runs`, { method: "POST", headers, body: JSON.stringify({ app }) });
const { id, error } = await r.json();
if (!id) { console.log("start failed:", error); process.exit(1); }
console.log("run", id);
const res = await fetch(`${base}/api/runs/${id}/events`, { headers });
const dec = new TextDecoder(); let buf = "";
for await (const chunk of res.body) {
  buf += dec.decode(chunk);
  let i;
  while ((i = buf.indexOf("\n\n")) >= 0) {
    const ev = JSON.parse(buf.slice(6, i)); buf = buf.slice(i + 2);
    if (ev.type === "item" && ev.phase === "started") continue;
    const s = ev.type === "item" ? `${ev.kind}: ${ev.query ?? ev.command ?? (ev.tool ? ev.server + "." + ev.tool : "") ?? ""} ${ev.text ?? ""}` : ev.type === "saved" ? `SAVED /guides/${ev.slug} difficulty=${ev.guide.verdict.difficulty} mode=${ev.guide.mode} tested=${ev.guide.tested.length} sources=${ev.guide.sources.length}` : JSON.stringify(ev);
    console.log(new Date().toISOString().slice(11, 19), s.slice(0, 220));
    if (ev.type === "question") await fetch(`${base}/api/runs/${id}/answer`, { method: "POST", headers, body: JSON.stringify({ qid: ev.qid, text: "skip" }) });
  }
}
