import { NextResponse } from "next/server";
import { bancoConfigurado, carregarBanco } from "@/lib/server/db";
import { conexaoSalva } from "@/lib/server/evolution";
import { gerarCartao } from "@/lib/server/cartoes";
import { buscarEvangelho } from "@/lib/server/evangelho";
import { autorizadoAgendado, destinosAgendados, enviarParaTodos, hojeSP, jaEnviado, marcarEnviado } from "@/lib/server/agendados";
import { montarBomDia, textoBomDia } from "@/lib/bom-dia";
import { textoEvangelho } from "@/lib/evangelho";

// Manhã (7h–8h de Brasília, agendador da Vercel em vercel.json):
//  1. "Bom dia": compromissos de hoje, aniversariantes e tarefas a fazer (nada financeiro).
//  2. Evangelho do dia, logo em seguida.
// Cada um vai no máximo uma vez por dia (?forcar=1 manda de novo; ?previa=1 só mostra os textos).

export async function GET(req: Request) {
  if (!autorizadoAgendado(req)) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  if (!bancoConfigurado()) return NextResponse.json({ erro: "Banco não configurado" }, { status: 503 });
  const url = new URL(req.url);
  const forcar = url.searchParams.get("forcar") === "1";
  const hoje = hojeSP();
  const banco = await carregarBanco();
  const cfg = banco.config;
  const texto = textoBomDia(banco, montarBomDia(banco, hoje));

  if (url.searchParams.get("previa") === "1") {
    const ev = await buscarEvangelho(hoje);
    return NextResponse.json({ ok: true, hoje, bomDia: texto, evangelho: ev ? textoEvangelho(ev) : "(evangelho indisponível)" });
  }

  const conexao = await conexaoSalva();
  if (!conexao) {
    return NextResponse.json({ erro: "Evolution ainda não conhecida: mande qualquer mensagem no grupo de finanças (ou configure EVOLUTION_API_URL/KEY/INSTANCE)." }, { status: 409 });
  }
  const destinos = destinosAgendados(banco);
  if (!destinos.length) return NextResponse.json({ erro: "Nenhum grupo ou telefone cadastrado em Ajustes." }, { status: 409 });

  const saida: Record<string, unknown> = { hoje };

  // 1. bom dia
  if (cfg.whatsappBomDia === false) saida.bomDia = "desligado em Ajustes";
  else if (!forcar && (await jaEnviado(hoje))) saida.bomDia = "já enviado hoje";
  else {
    const imagem = cfg.whatsappImagens !== false ? await gerarCartao(banco, { tipo: "bomdia" }, hoje) : null;
    const r = await enviarParaTodos(conexao, destinos, { texto, imagem }, cfg.nomeRobo);
    if (r.ok) await marcarEnviado(hoje, r.resultado);
    saida.bomDia = r.resultado;
  }

  // 2. evangelho do dia
  const chaveEv = `evangelho-${hoje}`;
  if (cfg.whatsappEvangelho === false) saida.evangelho = "desligado em Ajustes";
  else if (!forcar && (await jaEnviado(chaveEv))) saida.evangelho = "já enviado hoje";
  else {
    const ev = await buscarEvangelho(hoje);
    if (!ev) saida.evangelho = "não consegui buscar o evangelho de hoje";
    else {
      const r = await enviarParaTodos(conexao, destinos, { texto: textoEvangelho(ev) }, cfg.nomeRobo);
      if (r.ok) await marcarEnviado(chaveEv, r.resultado);
      saida.evangelho = r.resultado;
    }
  }

  console.info(`manhã ${hoje}: ${JSON.stringify(saida)}`);
  return NextResponse.json({ ok: true, ...saida });
}
