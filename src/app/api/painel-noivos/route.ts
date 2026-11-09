import { NextResponse } from "next/server";
import { bancoConfigurado, carregarBanco } from "@/lib/server/db";
import { anunciarConfirmacoes, verificarConfirmacoes } from "@/lib/server/painel";
import { autorizadoAgendado } from "@/lib/server/agendados";
import type { AvisoConfirmacao } from "@/lib/convidados";

// Painel dos Noivos -> grupo do WhatsApp.
//  POST: webhook do painel (PAINEL_WEBHOOK_URL), com Authorization: Bearer PAINEL_API_TOKEN.
//  GET:  consulta as confirmações novas (para um cron, caso o painel não consiga chamar o webhook).
//        Autorização igual à do bom dia (?token=WHATSAPP_WEBHOOK_TOKEN ou Bearer CRON_SECRET).

export async function POST(req: Request) {
  const token = process.env.PAINEL_API_TOKEN;
  if (!token) return NextResponse.json({ erro: "PAINEL_API_TOKEN não configurado" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${token}`) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  if (!bancoConfigurado()) return NextResponse.json({ erro: "Banco não configurado" }, { status: 503 });
  const corpo = (await req.json().catch(() => null)) as AvisoConfirmacao | null;
  if (!corpo?.confirmacao?.id) return NextResponse.json({ erro: "Corpo inválido" }, { status: 400 });
  if (corpo.evento && corpo.evento !== "confirmacao") return NextResponse.json({ ok: true, ignorado: corpo.evento });
  const avisadas = await anunciarConfirmacoes(await carregarBanco(), [corpo], corpo.resumo ?? null);
  console.info(`painel: confirmação #${corpo.confirmacao.id} recebida pelo webhook${avisadas ? " e avisada no grupo" : " (já avisada ou sem destino)"}`);
  return NextResponse.json({ ok: true, avisadas });
}

export async function GET(req: Request) {
  if (!autorizadoAgendado(req)) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  if (!bancoConfigurado()) return NextResponse.json({ erro: "Banco não configurado" }, { status: 503 });
  const r = await verificarConfirmacoes(await carregarBanco());
  return NextResponse.json({ ok: !r.erro, ...r }, { status: r.erro ? 502 : 200 });
}
