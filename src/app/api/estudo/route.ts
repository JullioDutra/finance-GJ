import { NextResponse } from "next/server";
import { bancoConfigurado, carregarBanco } from "@/lib/server/db";
import { conexaoSalva } from "@/lib/server/evolution";
import { autorizadoAgendado, destinosAgendados, enviarParaTodos, hojeSP, jaEnviado, marcarEnviado } from "@/lib/server/agendados";
import { textoEstudo } from "@/lib/estudo";

// Noite (20h–21h de Brasília, agendador da Vercel em vercel.json): lembrete para estudar para os concursos.
// Uma vez por dia (?forcar=1 manda de novo; ?previa=1 só mostra o texto).

export async function GET(req: Request) {
  if (!autorizadoAgendado(req)) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  if (!bancoConfigurado()) return NextResponse.json({ erro: "Banco não configurado" }, { status: 503 });
  const url = new URL(req.url);
  const hoje = hojeSP();
  const texto = textoEstudo(hoje);
  if (url.searchParams.get("previa") === "1") return NextResponse.json({ ok: true, hoje, texto });

  const banco = await carregarBanco();
  if (banco.config.whatsappEstudo === false) return NextResponse.json({ ok: true, ignorado: "lembrete de estudo desligado em Ajustes" });
  const chave = `estudo-${hoje}`;
  if (url.searchParams.get("forcar") !== "1" && (await jaEnviado(chave))) return NextResponse.json({ ok: true, ignorado: "já enviado hoje" });

  const conexao = await conexaoSalva();
  if (!conexao) return NextResponse.json({ erro: "Evolution ainda não conhecida: mande qualquer mensagem no grupo de finanças." }, { status: 409 });
  const destinos = destinosAgendados(banco);
  if (!destinos.length) return NextResponse.json({ erro: "Nenhum grupo ou telefone cadastrado em Ajustes." }, { status: 409 });

  const r = await enviarParaTodos(conexao, destinos, { texto }, banco.config.nomeRobo);
  if (r.ok) await marcarEnviado(chave, r.resultado);
  console.info(`estudo ${hoje}: ${JSON.stringify(r.resultado)}`);
  return NextResponse.json({ ok: r.ok, hoje, enviado: r.resultado }, { status: r.ok ? 200 : 502 });
}
