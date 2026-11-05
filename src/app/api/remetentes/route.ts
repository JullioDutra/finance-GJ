import { NextResponse } from "next/server";
import { aplicarNoServidor, bancoConfigurado, carregarBanco, gravarInterno, lerInterno } from "@/lib/server/db";

// Números que mandaram mensagem ao robô e foram recusados (não cadastrados).
// Só quem está logado chega aqui (o proxy exige a sessão), então só vocês podem aprovar.

interface Recusado {
  id: string;
  lid: boolean;
  nome: string;
  texto: string;
  quando: string;
}

export async function GET(req: Request) {
  void req.url;
  if (!bancoConfigurado()) return NextResponse.json({ recusados: [] });
  const lista = await lerInterno<Recusado>("_whatsapp_recusados");
  lista.sort((a, b) => b.quando.localeCompare(a.quando));
  return NextResponse.json({ recusados: lista.slice(0, 10) }, { headers: { "Cache-Control": "no-store" } });
}

/** Aprova: { id, pessoa: "p1" | "p2" } — passa a reconhecer esse ID como a pessoa. */
export async function POST(req: Request) {
  if (!bancoConfigurado()) return NextResponse.json({ erro: "Banco não configurado" }, { status: 400 });
  const { id, pessoa } = (await req.json().catch(() => ({}))) as { id?: string; pessoa?: string };
  if (!id || !/^\d{6,25}$/.test(id) || (pessoa !== "p1" && pessoa !== "p2")) {
    return NextResponse.json({ erro: "Dados inválidos" }, { status: 400 });
  }
  const banco = await carregarBanco();
  const campo = pessoa === "p1" ? "whatsappExtraP1" : "whatsappExtraP2";
  const atuais = banco.config[campo] ?? [];
  const config = { ...banco.config, [campo]: [...new Set([...atuais, id])] };
  await aplicarNoServidor([{ tipo: "upsert", colecao: "config", id: "config", dados: config }]);
  await gravarInterno("_whatsapp_recusados", id, null);
  return NextResponse.json({ ok: true });
}

/** Descarta da lista: ?id=... */
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !bancoConfigurado()) return NextResponse.json({ erro: "Dados inválidos" }, { status: 400 });
  await gravarInterno("_whatsapp_recusados", id, null);
  return NextResponse.json({ ok: true });
}
