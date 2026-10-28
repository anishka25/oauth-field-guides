import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { Guide } from "./schema";

const CURATED_DIR = path.join(process.cwd(), "data", "guides");
// Vercel's filesystem is read-only except /tmp, which is per-instance and
// ephemeral; set the Upstash vars there for durable share links.
const GENERATED_DIR = process.env.VERCEL ? "/tmp/generated" : path.join(process.cwd(), "data", "generated");

// Generated guides go to Upstash Redis when configured (needed on Vercel, whose
// filesystem is read-only), otherwise to ./data/generated.
const KV_URL = process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function kv(cmd: unknown[]) {
  const r = await fetch(KV_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  return (await r.json()).result;
}

async function readDir(dir: string): Promise<Guide[]> {
  const files = await fs.readdir(dir).catch(() => [] as string[]);
  const out: Guide[] = [];
  for (const f of files.filter((f) => f.endsWith(".json"))) {
    const parsed = Guide.safeParse(JSON.parse(await fs.readFile(path.join(dir, f), "utf8")));
    if (parsed.success) out.push(parsed.data);
    else console.warn(`invalid guide ${f}`, parsed.error.issues.slice(0, 3));
  }
  return out;
}

async function generated(): Promise<Guide[]> {
  if (KV_URL) {
    const all: Record<string, string> | string[] = (await kv(["HGETALL", "guides"])) ?? [];
    const vals = Array.isArray(all) ? all.filter((_, i) => i % 2) : Object.values(all);
    return vals.map((v) => JSON.parse(v));
  }
  return readDir(GENERATED_DIR);
}

export async function listGuides(): Promise<Guide[]> {
  const [c, g] = await Promise.all([readDir(CURATED_DIR), generated()]);
  const bySlug = new Map<string, Guide>();
  for (const x of [...g, ...c]) bySlug.set(x.slug, x); // curated wins on conflict
  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getGuide(slug: string) {
  return (await listGuides()).find((g) => g.slug === slug) ?? null;
}

export async function saveGenerated(g: Guide) {
  const curated = await readDir(CURATED_DIR);
  if (curated.some((c) => c.slug === g.slug)) g = { ...g, slug: `${g.slug}-agent` };
  if (KV_URL) await kv(["HSET", "guides", g.slug, JSON.stringify(g)]);
  else {
    await fs.mkdir(GENERATED_DIR, { recursive: true });
    await fs.writeFile(path.join(GENERATED_DIR, `${g.slug}.json`), JSON.stringify(g, null, 2));
  }
  return g.slug;
}
