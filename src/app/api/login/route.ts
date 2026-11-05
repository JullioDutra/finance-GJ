import { NextResponse } from "next/server";
import { COOKIE_SESSAO, OPCOES_COOKIE_SESSAO, tokenSessao } from "@/lib/server/auth";

export async function POST(req: Request) {
  const { pin } = (await req.json().catch(() => ({}))) as { pin?: string };
  if (!process.env.APP_PIN || String(pin ?? "") !== process.env.APP_PIN) {
    await new Promise((r) => setTimeout(r, 600)); // dificulta tentativa e erro
    return NextResponse.json({ erro: "PIN incorreto" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_SESSAO, await tokenSessao(), OPCOES_COOKIE_SESSAO);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_SESSAO);
  return res;
}
