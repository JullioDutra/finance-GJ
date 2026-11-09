// Modelos (templates) das mensagens do robô no WhatsApp.
// Usa só a formatação nativa do WhatsApp: *negrito*, _itálico_, ~riscado~, `código`,
// ```bloco monoespaçado``` (para alinhar valores) e "> " para citação.

import type { Categoria } from "./types";

/** Linha divisória das versões antigas (ainda reconhecida como mensagem do robô). */
export const DIVISOR = "━━━━━━━━━━━━━━━━━━";

/** Marca invisível no começo de toda mensagem do robô (evita responder a si mesmo). */
export const MARCA = "\u2063";

export function ehMensagemDoRobo(texto: string): boolean {
  const t = texto.trimStart();
  return t.includes(MARCA) || t.includes(DIVISOR) || t.startsWith("🤖");
}

/** Linha de assinatura do robô ("*Ron Weasley(bot):*"), ou vazio. */
export function assinatura(nomeRobo: string | undefined): string {
  const n = (nomeRobo ?? "").trim();
  return n ? `*${n}(bot):*` : "";
}

/**
 * Mensagem final enviada pelo robô: assinatura na primeira linha e a marca invisível no FIM
 * (no começo ela impedia o WhatsApp de deixar em negrito o *texto* logo depois dela).
 */
export function assinar(texto: string, nomeRobo: string | undefined): string {
  const a = assinatura(nomeRobo);
  const corpo = texto.split(MARCA).join("").trim();
  return `${a ? `${a}\n` : ""}${corpo}${MARCA}`;
}

/** Tira emojis coloridos (mantém símbolos simples como • ✓ ○ ▲ ▼ ─ ▰ ▱). */
export function semEmojis(texto: string): string {
  return texto
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\u{FE0F}\u{200D}\u{20E3}\u{1F3FB}-\u{1F3FF}]/gu, "")
    .split("\n")
    .map((l) => l.replace(/^[ \t]+/, "").replace(/ {2,}/g, " "))
    .join("\n");
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
/**
 * Mensagem padrão do robô, estilo "texto limpo": título em negrito, corpo e rodapé discreto em itálico.
 * Sem emojis; blocos ``` (tabelas) são preservados como estão.
 */
export function cartao(titulo: string, corpo: (string | null | false | undefined)[], rodape?: string): string {
  const linhas = corpo.filter((x): x is string => typeof x === "string");
  const limpo = (t: string) => t.split(/(```[\s\S]*?```)/).map((parte) => (parte.startsWith("```") ? parte : semEmojis(parte))).join("");
  const texto = [limpo(titulo).trim(), ...linhas.map(limpo), ...(rodape ? ["", `_${semEmojis(rodape).trim()}_`] : [])].join("\n");
  return MARCA + texto.replace(/\n{3,}/g, "\n\n").trim();
}

export const MSG_AJUDA = cartao(
  "*Como usar o G&J Finanças*",
  [
    "",
    "*Lançar*",
    "- `mercado 154,90`",
    "- `gastei 45 uber`",
    "- `recebi 3500 salário`",
    "- `guardei 500` _(reserva do casamento)_",
    "- `paguei luz` _(conta do dia 6)_",
    "- termine com `ontem` ou `12/03` para mudar a data",
    "- `desfazer` apaga o último lançamento",
    "",
    "*Agenda*",
    "- `agenda` · `agenda amanhã` · `agenda semana` · `agenda 21/11`",
    "- `marcar sexta 19h dentista`",
    "- `desmarcar dentista`",
    "- `buscar vestido` · `buscar 21/11`",
    "- `calendario` · `calendario dezembro`: o mês com os dias ocupados em vermelho",
    "- vários de uma vez: `marcar` e um item por linha",
    "",
    "*Casamento*",
    "- `tarefas` mostra o checklist numerado",
    "- `feito 3` marca como feita · `feito 2 5 7` várias",
    "- `tarefa olhar convites` · `reabrir convites`",
    "- `casamento` mostra os pagamentos",
    "",
    "*Convidados (site do casamento)*",
    "- `convidados` resumo · `confirmados` · `pendentes convidados` · `faltando`",
    "- `novo convidado Maria Souza 3` · `convidado Maria` · `remover convidado Maria`",
    "- cada confirmação feita no site chega aqui no grupo",
    "",
    "*Aniversários*",
    "- `aniversário tia Ana 15/03` · `aniversários`",
    "- `apagar aniversário Ana`",
    "",
    "*Todo dia*",
    "- de manhã: *bom dia* com compromissos, aniversariantes e tarefas, e o evangelho",
    "- à noite: lembrete de estudar para os concursos",
    "- `bom dia` · `evangelho` a qualquer hora",
    "",
    "*Consultas*",
    "- `resumo` · `contas`",
  ],
  "Quando der certo, eu reajo com ✓ na sua mensagem",
);

/** Consultas que viram cartão em imagem (ver src/lib/server/cartoes.tsx). */
export type PedidoImagem =
  | { tipo: "resumo"; mes: string }
  | { tipo: "contas"; mes: string }
  | { tipo: "casamento" }
  | { tipo: "agenda"; de: string; ate: string; titulo: string }
  | { tipo: "tarefas" }
  | { tipo: "busca"; termo: string }
  | { tipo: "ajuda" }
  | { tipo: "lista"; lote: string; semData: string[]; repetidos: number }
  | { tipo: "bomdia" }
  | { tipo: "aniversarios" }
  | { tipo: "calendario"; mes: string }
  | { tipo: "convidados"; resumo: import("./convidados").ResumoPainel }
  | { tipo: "lista-convidados"; status: "confirmados" | "pendentes" | "faltando" | "todos"; convites: import("./convidados").ConviteResumido[] };

// ---------- botões (Evolution sendButtons: até 3 respostas rápidas) ----------
export interface BotaoWhats {
  id: string; // comando enviado de volta quando clicado
  texto: string; // até ~20 caracteres
}

export const BT = {
  resumo: { id: "resumo", texto: "Resumo" },
  contas: { id: "contas", texto: "Contas" },
  casamento: { id: "casamento", texto: "Casamento" },
  ajuda: { id: "ajuda", texto: "Ajuda" },
  encerrar: { id: "encerrar", texto: "Encerrar" },
  iniciar: { id: "iniciar finanças", texto: "Iniciar finanças" },
  desfazer: (lancamentoId: string): BotaoWhats => ({ id: `desfazer ${lancamentoId}`, texto: "Desfazer" }),
} as const;

/** Separa um cartão em título / corpo / rodapé (formato usado pelos botões). */
export function separarCartao(texto: string): { titulo: string; corpo: string; rodape: string } {
  const linhas = texto.replace(MARCA, "").split("\n");
  const titulo = (linhas[0] ?? "").replace(/\*/g, "").trim();
  let fim = linhas.length;
  let rodape = "";
  const ult = (linhas[linhas.length - 1] ?? "").trim();
  if (linhas.length >= 3 && /^_.*_$/.test(ult) && (linhas[linhas.length - 2].trim() === "" || linhas[linhas.length - 2] === DIVISOR)) {
    rodape = ult.slice(1, -1);
    fim = linhas.length - 2;
  }
  const inicio = linhas[1] === DIVISOR ? 2 : 1;
  return { titulo, corpo: linhas.slice(inicio, fim).join("\n").trim(), rodape };
}
