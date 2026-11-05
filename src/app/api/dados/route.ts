import { NextResponse } from "next/server";
import { aplicarNoServidor, bancoConfigurado, carregarBanco } from "@/lib/server/db";
import type { Op } from "@/lib/ops";

// GET: devolve todos os dados. POST: aplica uma lista de operações.
// (O proxy já garante que só quem tem o PIN chega aqui.)

export async function GET(req: Request) {
  void req.url; // garante execução por requisição
  if (!bancoConfigurado()) return NextResponse.json({ modo: "local" });
  try {
    const banco = await carregarBanco();
    return NextResponse.json({ modo: "nuvem", banco }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ modo: "erro", erro: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!bancoConfigurado()) return NextResponse.json({ erro: "Banco não configurado" }, { status: 400 });
  const body = (await req.json().catch(() => null)) as { ops?: Op[] } | null;
  if (!body || !Array.isArray(body.ops)) return NextResponse.json({ erro: "Formato inválido" }, { status: 400 });
  try {
    await aplicarNoServidor(body.ops);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
