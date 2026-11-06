// Modelos (templates) das mensagens do robô no WhatsApp.
// Usa só a formatação nativa do WhatsApp: *negrito*, _itálico_, ~riscado~, `código`,
// ```bloco monoespaçado``` (para alinhar valores) e "> " para citação.

import type { Categoria } from "./types";

/** Linha divisória — também marca as mensagens do próprio robô (evita responder a si mesmo). */
export const DIVISOR = "━━━━━━━━━━━━━━━━━━";

export function ehMensagemDoRobo(texto: string): boolean {
  const t = texto.trim();
  return t.includes(DIVISOR) || t.startsWith("🤖");
}

const EMOJI_ICONE: Record<string, string> = {
  casa: "🏠", energia: "💡", agua: "🚿", internet: "📶", gas: "🔥", mercado: "🛒", sofa: "🛋️", carro: "🚗",
  comida: "🍽️", saude: "💊", lazer: "🎉", compras: "🛍️", estudo: "📚", cartao: "💳", alianca: "💍", caixa: "📦",
  trabalho: "💼", extra: "✨", moedas: "🪙", cofre: "🐷", presente: "🎁", viagem: "✈️", roupa: "👕", beleza: "💇",
  musica: "🎵", foto: "📷", flores: "💐", igreja: "⛪", banco: "🏦", dinheiro: "💵", correio: "✉️", outros: "🏷️",
};

const ICONE_POR_ID: Record<string, string> = {
  "cat-aluguel": "casa", "cat-energia": "energia", "cat-agua": "agua", "cat-internet": "internet", "cat-gas": "gas",
  "cat-mercado": "mercado", "cat-casa": "sofa", "cat-transporte": "carro", "cat-alimentacao": "comida",
  "cat-saude": "saude", "cat-lazer": "lazer", "cat-compras": "compras", "cat-educacao": "estudo",
  "cat-cartao": "cartao", "cat-casamento": "alianca", "cat-outros": "caixa", "cat-salario": "trabalho",
  "cat-extra": "extra", "cat-outras-receitas": "moedas", "cat-reserva-casamento": "cofre",
};

export function emojiCategoria(c?: Pick<Categoria, "id" | "icone" | "emoji">): string {
  if (!c) return "🏷️";
  return EMOJI_ICONE[c.icone ?? ""] ?? EMOJI_ICONE[ICONE_POR_ID[c.id] ?? ""] ?? c.emoji ?? "🏷️";
}

/** Barra de progresso em texto: ▰▰▰▱▱▱▱▱▱▱ */
export function barra(fracao: number, tamanho = 10): string {
  const f = Math.max(0, Math.min(1, Number.isFinite(fracao) ? fracao : 0));
  const cheios = Math.round(f * tamanho);
  return "▰".repeat(cheios) + "▱".repeat(tamanho - cheios);
}

export function pctTexto(fracao: number): string {
  return `${Math.round((Number.isFinite(fracao) ? fracao : 0) * 100)}%`;
}

/** Tabela alinhada em bloco monoespaçado (rótulo à esquerda, valor à direita). */
export function tabela(linhas: ([string, string] | "---")[]): string {
  const pares = linhas.filter((l): l is [string, string] => l !== "---");
  const larguraRotulo = Math.max(...pares.map(([r]) => r.length));
  const larguraValor = Math.max(...pares.map(([, v]) => v.length));
  const total = larguraRotulo + 2 + larguraValor;
  const corpo = linhas.map((l) => (l === "---" ? "─".repeat(total) : `${l[0].padEnd(larguraRotulo)}  ${l[1].padStart(larguraValor)}`));
  return "```\n" + corpo.join("\n") + "\n```";
}

/** Cartão padrão: título, divisória, corpo e rodapé opcional em itálico. */
export function cartao(titulo: string, corpo: (string | null | false | undefined)[], rodape?: string): string {
  const linhas = corpo.filter((x): x is string => typeof x === "string");
  return [titulo, DIVISOR, ...linhas, ...(rodape ? [DIVISOR, `_${rodape}_`] : [])].join("\n");
}

export const MSG_AJUDA = cartao(
  "📖 *Como usar o G&J Finanças*",
  [
    "*Lançar*",
    "🛒 `mercado 154,90`",
    "🚗 `gastei 45 uber`",
    "💰 `recebi 3500 salário`",
    "🐷 `guardei 500` _(reserva do casamento)_",
    "✅ `paguei luz` _(conta do dia 6)_",
    "",
    "*Ajustes no lançamento*",
    "📅 termine com `ontem` ou `12/03`",
    "👥 inclua `casal` para lançar como do casal",
    "",
    "*Agenda*",
    "📅 `agenda` · `agenda amanhã` · `agenda semana`",
    "➕ `marcar sexta 19h dentista`",
    "🗑️ `desmarcar dentista`",
    "🔎 `buscar buffet`",
    "📋 lista: `marcar` e um item por linha",
    "📝 `tarefa olhar cartório` · `tarefas`",
    "",
    "*Consultas*",
    "`resumo` · `contas` · `casamento`",
  ],
  "Para sair do modo finanças mande encerrar",
);

// ---------- botões (Evolution sendButtons: até 3 respostas rápidas) ----------
export interface BotaoWhats {
  id: string; // comando enviado de volta quando clicado
  texto: string; // até ~20 caracteres
}

export const BT = {
  resumo: { id: "resumo", texto: "📊 Resumo" },
  contas: { id: "contas", texto: "🗓️ Contas" },
  casamento: { id: "casamento", texto: "💍 Casamento" },
  ajuda: { id: "ajuda", texto: "📖 Ajuda" },
  encerrar: { id: "encerrar", texto: "👋 Encerrar" },
  iniciar: { id: "iniciar finanças", texto: "💰 Iniciar finanças" },
  desfazer: (lancamentoId: string): BotaoWhats => ({ id: `desfazer ${lancamentoId}`, texto: "↩️ Desfazer" }),
} as const;

/** Separa um cartão em título / corpo / rodapé (formato usado pelos botões). */
export function separarCartao(texto: string): { titulo: string; corpo: string; rodape: string } {
  const linhas = texto.split("\n");
  const titulo = (linhas[0] ?? "").replace(/^\*|\*$/g, "").replace(/\*/g, "");
  let fim = linhas.length;
  let rodape = "";
  const ult = linhas[linhas.length - 1] ?? "";
  if (linhas.length >= 3 && linhas[linhas.length - 2] === DIVISOR && /^_.*_$/.test(ult)) {
    rodape = ult.slice(1, -1);
    fim = linhas.length - 2;
  }
  const inicio = linhas[1] === DIVISOR ? 2 : 1;
  return { titulo, corpo: linhas.slice(inicio, fim).join("\n").trim(), rodape };
}
