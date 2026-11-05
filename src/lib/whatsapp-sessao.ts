// "Modo finanças" no WhatsApp: o robô só lê as mensagens depois de "iniciar finanças"
// e volta para a conversa normal com "encerrar" ou após alguns minutos sem uso.

import { semAcento } from "./format";

export const MINUTOS_SESSAO = 10;

export interface SessaoWhatsapp {
  id: string; // conversa (jid do contato ou do grupo)
  expira: number; // timestamp em ms
}

const INICIAR = new Set(["iniciar financas", "iniciar financa", "iniciar o financas", "iniciar modo financas"]);
const ENCERRAR = new Set(["encerrar", "encerrar financas", "sair", "fim", "parar", "finalizar"]);

function normalizar(texto: string): string {
  return semAcento(texto)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Reconhece só a mensagem exata do comando (não dispara no meio de uma conversa). */
export function comandoSessao(texto: string): "iniciar" | "encerrar" | null {
  const t = normalizar(texto);
  if (INICIAR.has(t)) return "iniciar";
  if (ENCERRAR.has(t)) return "encerrar";
  return null;
}

export function sessaoAtiva(s: SessaoWhatsapp | undefined, agora: number): boolean {
  return !!s && s.expira > agora;
}

export function novaExpiracao(agora: number): number {
  return agora + MINUTOS_SESSAO * 60_000;
}

export const MSG_INICIO = `*Modo finanças ativo* 💰

Pode mandar os lançamentos, ex.: \`mercado 154,90\`, \`recebi 3500 salário\`, \`guardei 500\`, \`paguei luz\`.
Consultas: \`resumo\`, \`contas\`, \`casamento\`, \`ajuda\`.

Para voltar à conversa normal mande *encerrar* (ou fecha sozinho após ${MINUTOS_SESSAO} min sem mensagens).`;

export const MSG_FIM = "Modo finanças encerrado. Voltamos à conversa normal 🙂";
