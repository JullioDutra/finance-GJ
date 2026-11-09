import { NextResponse } from "next/server";
import { bancoConfigurado, carregarBanco } from "@/lib/server/db";
import { gerarCartao } from "@/lib/server/cartoes";
import { somarDias } from "@/lib/agenda";
import type { PedidoImagem } from "@/lib/whatsapp";

// Prévia dos cartões do WhatsApp (só para quem está logado — o proxy exige a sessão).
// /api/cartao?tipo=resumo|contas|casamento|agenda|tarefas|busca|ajuda|bomdia|aniversarios

function hojeSP(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

export async function GET(req: Request) {
  if (!bancoConfigurado())
    return NextResponse.json(
      { erro: "Banco não configurado" },
      { status: 400 },
    );
  const tipo = new URL(req.url).searchParams.get("tipo") ?? "resumo";
  const hoje = hojeSP();
  const pedido: PedidoImagem =
    tipo === "contas"
      ? { tipo: "contas", mes: hoje.slice(0, 7) }
      : tipo === "casamento"
        ? { tipo: "casamento" }
        : tipo === "tarefas" || tipo === "ajuda" || tipo === "bomdia" || tipo === "aniversarios"
          ? { tipo }
          : tipo === "busca"
            ? {
                tipo: "busca",
                termo:
                  new URL(req.url).searchParams.get("termo") || "casamento",
              }
            : tipo === "agenda"
              ? {
                  tipo: "agenda",
                  de: hoje,
                  ate: somarDias(hoje, 6),
                  titulo: "Próximos 7 dias",
                }
              : { tipo: "resumo", mes: hoje.slice(0, 7) };
  const c = await gerarCartao(await carregarBanco(), pedido, hoje);
  if (!c)
    return NextResponse.json(
      { erro: "Não foi possível gerar o cartão" },
      { status: 500 },
    );
  return new Response(Buffer.from(c.base64, "base64"), {
    headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
  });
}
