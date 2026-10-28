import { NextResponse } from "next/server";
import { startRun } from "@/lib/sandbox";
import { hasAccess } from "@/lib/access";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!(await hasAccess(req))) return Response.json({ error: "Access code required" }, { status: 401 });
  const { app } = await req.json();
  if (typeof app !== "string" || !app.trim() || app.length > 200)
    return NextResponse.json({ error: "Enter an app name or website" }, { status: 400 });
  try {
    return NextResponse.json({ id: await startRun(app.trim()) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: `Could not start sandbox: ${(e as Error).message}` }, { status: 500 });
  }
}
