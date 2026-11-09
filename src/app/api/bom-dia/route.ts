import { NextResponse } from "next/server";
import { bancoConfigurado, carregarBanco, gravarInterno, lerInterno } from "@/lib/server/db";
import { conexaoSalva, enviarImagem, enviarTexto } from "@/lib/server/evolution";
import { gerarCartao } from "@/lib/server/cartoes";
import { montarBomDia, textoBomDia } from "@/lib/bom-dia";

// "Bom dia" das 7h: compromissos do dia, aniversários e o Radar do casal no grupo de finanças.
// Chamado pelo agendador da Vercel (vercel.json, 10:00 UTC = 7h de Brasília) ou por um cron na VPS.
// Segurança: Authorization: Bearer CRON_SECRET (a Vercel manda sozinha) ou ?token=WHATSAPP_WEBHOOK_TOKEN.
// Envia no máximo uma vez por dia (?forcar=1 manda de novo; ?previa=1 só mostra o texto).

function hojeSP(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function autorizado(req: Request): boolean {
  const url = new URL(req.url);
  const cron = process.env.CRON_SECRET;
  const token = process.env.WHATSAPP_WEBHOOK_TOKEN;
  if (cron && req.headers.get("authorization") === `Bearer ${cron}`) return true;
  if (token && url.searchParams.get("token") === token) return true;
  return !cron && !token; // sem nenhum segredo configurado (só em testes locais)
}

const digitos = (t: string) => t.replace(/\D/g, "");

export async function GET(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  if (!bancoConfigurado()) return NextResponse.json({ erro: "Banco não configurado" }, { status: 503 });
  const url = new URL(req.url);
  const forcar = url.searchParams.get("forcar") === "1";
  const previa = url.searchParams.get("previa") === "1";
  const hoje = hojeSP();

  const banco = await carregarBanco();
  const texto = textoBomDia(banco, montarBomDia(banco, hoje));
  if (previa) return NextResponse.json({ ok: true, hoje, texto });
  if (banco.config.whatsappBomDia === false) return NextResponse.json({ ok: true, ignorado: "bom dia desligado em Ajustes" });

  const enviados = await lerInterno<{ id: string }>("_whatsapp_bomdia");
  if (!forcar && enviados.some((e) => e.id === hoje)) return NextResponse.json({ ok: true, ignorado: "já enviado hoje" });

  const conexao = await conexaoSalva();
  if (!conexao) {
    return NextResponse.json({ erro: "Evolution ainda não conhecida: mande qualquer mensagem no grupo de finanças (ou configure EVOLUTION_API_URL/KEY/INSTANCE)." }, { status: 409 });
  }
  // para onde: o grupo de finanças; sem grupo, a conversa de cada um
  const destinos = banco.config.grupoWhatsapp
    ? [banco.config.grupoWhatsapp]
    : [banco.config.telefoneP1, banco.config.telefoneP2].map(digitos).filter((t) => t.length >= 10);
  if (!destinos.length) return NextResponse.json({ erro: "Nenhum grupo ou telefone cadastrado em Ajustes." }, { status: 409 });

  const imagem = banco.config.whatsappImagens !== false ? await gerarCartao(banco, { tipo: "bomdia" }, hoje) : null;
  const resultado: Record<string, string> = {};
  for (const para of destinos) {
    let ok = false;
    if (imagem) ok = await enviarImagem(conexao, para, imagem.base64, imagem.legenda);
    const modo = ok ? "imagem" : "texto";
    if (!ok) ok = await enviarTexto(conexao, para, texto);
    resultado[para.endsWith("@g.us") ? "grupo" : `…${para.slice(-4)}`] = ok ? modo : "falhou";
  }
  const algum = Object.values(resultado).some((v) => v !== "falhou");
  if (algum) await gravarInterno("_whatsapp_bomdia", hoje, { id: hoje, quando: new Date().toISOString(), resultado });
  console.info(`bom dia ${hoje}: ${JSON.stringify(resultado)}`);
  return NextResponse.json({ ok: algum, hoje, enviado: resultado }, { status: algum ? 200 : 502 });
}
