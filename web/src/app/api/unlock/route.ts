import { NextResponse } from "next/server";
import { COOKIE, MAX_AGE_S, checkCode, makeToken } from "@/lib/access";

export async function POST(req: Request) {
  const { code } = await req.json().catch(() => ({ code: "" }));
  if (typeof code !== "string" || !(await checkCode(code))) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return NextResponse.json({ error: "Wrong access code" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await makeToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_S,
  });
  return res;
}
