// "Modo finanças" no WhatsApp: o robô só lê as mensagens depois de "iniciar finanças"
// e volta para a conversa normal com "encerrar" ou após alguns minutos sem uso.

import { semAcento } from "./format";
import { BT, cartao } from "./whatsapp-modelos";

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

export const MSG_INICIO = cartao(
  "👋 *Modo finanças ativo*",
  [
    "Pode mandar, uma coisa por mensagem:",
    "",
    "🛒 `mercado 154,90`",
    "💰 `recebi 3500 salário`",
    "🐷 `guardei 500`",
    "✅ `paguei luz`",
    "",
    "*Consultas:* `resumo` · `contas` · `casamento` · `ajuda`",
  ],
  `Para sair mande encerrar · fecha sozinho após ${MINUTOS_SESSAO} min`,
);

export const MSG_FIM = cartao("👋 *Até mais!*", ["Modo finanças encerrado.", "Podem conversar normalmente — eu fico quietinho por aqui."], "Para voltar: iniciar finanças");

export const BOTOES_INICIO = [BT.resumo, BT.contas, BT.casamento];
export const BOTOES_FIM = [BT.iniciar];

const ATIVAR_GRUPO = new Set(["ativar grupo", "ativar grupo financas", "ativar este grupo", "vincular grupo"]);

/** "ativar grupo" — registra o grupo atual como grupo de finanças. */
export function ehAtivarGrupo(texto: string): boolean {
  return ATIVAR_GRUPO.has(normalizar(texto));
}

export const MSG_GRUPO_ATIVADO = cartao(
  "✅ *Grupo de finanças ativado*",
  [
    "Daqui pra frente eu leio *só este grupo*.",
    "Não precisa de iniciar finanças: é só mandar.",
    "",
    "🛒 `mercado 154,90`",
    "💰 `recebi 3500 salário`",
    "🐷 `guardei 500`",
    "✅ `paguei luz`",
  ],
  "Mande ajuda para ver todos os comandos",
);

export const MSG_GRUPO_SEMPRE_ATIVO = cartao("💬 *Este grupo é de finanças*", ["Aqui eu estou sempre ativo — é só mandar os lançamentos."], "Mande ajuda para ver os comandos");
