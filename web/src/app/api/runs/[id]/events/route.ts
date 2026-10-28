import { saveGenerated } from "@/lib/guides";
import { stopRun, tailEvents } from "@/lib/sandbox";
import { Guide } from "@/lib/schema";
import { hasAccess } from "@/lib/access";

export const runtime = "nodejs";
export const maxDuration = 300; // Hobby cap; the client reconnects and the log replays

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAccess(req))) return Response.json({ error: "Access code required" }, { status: 401 });
  const { id } = await params;
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (o: unknown) => ctrl.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
      try {
        for await (const line of tailEvents(id, req.signal)) {
          let ev;
          try { ev = JSON.parse(line); } catch { continue; }
          if (ev.type === "guide") {
            // Validate before publishing; an invalid guide is reported, not saved.
            const parsed = Guide.safeParse({ ...ev.guide, origin: "agent" });
            if (parsed.success) {
              const slug = await saveGenerated(parsed.data);
              send({ type: "saved", slug, guide: { ...parsed.data, slug } });
            } else {
              send({ type: "error", text: `Guide failed validation: ${parsed.error.issues.slice(0, 3).map((i) => i.path.join(".") + " " + i.message).join("; ")}` });
            }
            continue;
          }
          send(ev);
          if (ev.type === "end") {
            await stopRun(id);
            break;
          }
        }
      } catch (e) {
        send({ type: "error", text: (e as Error).message });
      }
      ctrl.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
