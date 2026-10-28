import { NextResponse } from "next/server";
import { answer } from "@/lib/sandbox";
import { hasAccess } from "@/lib/access";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAccess(req))) return Response.json({ error: "Access code required" }, { status: 401 });
  const { id } = await params;
  const { qid, text } = await req.json();
  try {
    await answer(id, String(qid), String(text ?? ""));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
