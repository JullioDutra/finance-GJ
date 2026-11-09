import "server-only";
import { gravarInterno, lerInterno } from "./db";
import { enviarImagem, enviarTexto, type ConexaoEvolution } from "./evolution";
import type { Banco } from "../types";

// Mensagens agendadas (bom dia, evangelho, lembrete de estudo): autorização, destino e "uma vez por dia".

export function hojeSP(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Authorization: Bearer CRON_SECRET (a Vercel manda sozinha) ou ?token=WHATSAPP_WEBHOOK_TOKEN. */
export function autorizadoAgendado(req: Request): boolean {
  const url = new URL(req.url);
  const cron = process.env.CRON_SECRET;
  const token = process.env.WHATSAPP_WEBHOOK_TOKEN;
  if (cron && req.headers.get("authorization") === `Bearer ${cron}`) return true;
  if (token && url.searchParams.get("token") === token) return true;
  return !cron && !token; // sem nenhum segredo configurado (só em testes locais)
}

/** Para onde mandar: o grupo de finanças; sem grupo, a conversa de cada um. */
export function destinosAgendados(b: Banco): string[] {
  if (b.config.grupoWhatsapp) return [b.config.grupoWhatsapp];
  return [b.config.telefoneP1, b.config.telefoneP2].map((t) => t.replace(/\D/g, "")).filter((t) => t.length >= 10);
}

export async function jaEnviado(chave: string): Promise<boolean> {
  return (await lerInterno<{ id: string }>("_whatsapp_bomdia")).some((e) => e.id === chave);
}

export async function marcarEnviado(chave: string, resultado: Record<string, string>) {
  await gravarInterno("_whatsapp_bomdia", chave, { id: chave, quando: new Date().toISOString(), resultado });
}

/** Manda para todos os destinos: imagem (se houver) e, se falhar, o texto. */
export async function enviarParaTodos(c: ConexaoEvolution, destinos: string[], msg: { texto: string; imagem?: { base64: string; legenda: string } | null }, nomeRobo?: string) {
  const resultado: Record<string, string> = {};
  for (const para of destinos) {
    let ok = false;
    if (msg.imagem) ok = await enviarImagem(c, para, msg.imagem.base64, msg.imagem.legenda, nomeRobo);
    const modo = ok ? "imagem" : "texto";
    if (!ok) ok = await enviarTexto(c, para, msg.texto, nomeRobo);
    resultado[para.endsWith("@g.us") ? "grupo" : `…${para.slice(-4)}`] = ok ? modo : "falhou";
  }
  return { resultado, ok: Object.values(resultado).some((v) => v !== "falhou") };
}
