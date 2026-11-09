// Integração com o Painel dos Noivos (site do casamento, RSVP): tipos e textos do WhatsApp.
// Os formatos seguem painel/api.py do repositório JullioDutra/Casamento.

import { cartao } from "./whatsapp-modelos";
import { semAcento } from "./format";

export interface ResumoPainel {
  convites: number;
  convites_confirmados: number;
  convites_pendentes: number;
  pessoas_esperadas: number;
  pessoas_confirmadas: number;
  pessoas_faltando: number;
  confirmacoes_sem_vinculo: number;
}

export interface ConfirmacaoPainel {
  id: number;
  nome: string;
  telefone: string;
  quantidade: number;
  mensagem: string;
  criado_em: string;
}

export interface ConvitePainel {
  id: number;
  nome: string;
  telefone: string;
  grupo: string;
  observacoes: string;
  quantidade_esperada: number;
  quantidade_confirmada: number;
  faltam: number;
  confirmado: boolean;
  confirmacoes_site: ConfirmacaoPainel[];
}

export interface AvisoConfirmacao {
  evento?: string;
  confirmacao: ConfirmacaoPainel;
  convite: ConvitePainel | null;
  resumo?: ResumoPainel;
}

export type ComandoConvidados =
  | { tipo: "resumo" }
  | { tipo: "lista"; status: "confirmados" | "pendentes" | "faltando" | "todos" }
  | { tipo: "novo"; nome: string; quantidade: number; telefone: string }
  | { tipo: "ver"; busca: string }
  | { tipo: "remover"; busca: string; id: number | null };

const pessoas = (n: number) => `${n} pessoa${n === 1 ? "" : "s"}`;

/** Entende os comandos de convidados. null = não é comando de convidados. */
export function lerComandoConvidados(texto: string): ComandoConvidados | null {
  const t = texto.trim().replace(/\s+/g, " ");
  const n = semAcento(t).replace(/[!.?]+$/, "");
  if (["convidados", "rsvp", "presenca", "presencas", "confirmacoes", "lista de convidados", "resumo convidados"].includes(n)) return { tipo: "resumo" };
  if (["confirmados", "quem confirmou", "convidados confirmados"].includes(n)) return { tipo: "lista", status: "confirmados" };
  if (["pendentes convidados", "convidados pendentes", "nao confirmados", "quem falta", "falta confirmar"].includes(n)) return { tipo: "lista", status: "pendentes" };
  if (["faltando", "convidados faltando"].includes(n)) return { tipo: "lista", status: "faltando" };
  if (["todos os convidados", "convidados todos"].includes(n)) return { tipo: "lista", status: "todos" };

  const novo = n.match(/^(novo convidado|novo convite|adicionar convidado|add convidado|convidar)\s+(.+)$/);
  if (novo) {
    let resto = t.slice(t.length - novo[2].length);
    let telefone = "";
    const tel = resto.match(/(?:tel(?:efone)?:?\s*)?(\+?\d[\d\s().-]{9,}\d)/i);
    if (tel) {
      telefone = tel[1].replace(/\D/g, "");
      resto = resto.replace(tel[0], " ");
    }
    let quantidade = 1;
    const qtd = resto.match(/\s(\d{1,2})(?:\s*(?:pessoas?|convidados?|lugares?))?\s*$/i);
    if (qtd) {
      quantidade = Math.max(1, Number(qtd[1]));
      resto = resto.slice(0, qtd.index);
    }
    const nome = resto.replace(/\s+/g, " ").replace(/[,;:\-—]+$/, "").trim();
    return nome ? { tipo: "novo", nome, quantidade, telefone } : null;
  }

  const remover = n.match(/^(remover|apagar|excluir|tirar) (convidado|convite) (.+)$/);
  if (remover) {
    const alvo = t.slice(t.length - remover[3].length).trim();
    const id = alvo.match(/^#?(\d+)$/);
    return { tipo: "remover", busca: alvo, id: id ? Number(id[1]) : null };
  }

  const ver = n.match(/^(convidado|convite) (.+)$/);
  if (ver) return { tipo: "ver", busca: t.slice(t.length - ver[2].length).trim() };
  return null;
}

export function buscarConvites(lista: ConvitePainel[], busca: string): ConvitePainel[] {
  const alvo = semAcento(busca).trim();
  if (!alvo) return [];
  const exatos = lista.filter((c) => semAcento(c.nome) === alvo);
  if (exatos.length) return exatos;
  const palavras = alvo.split(" ");
  return lista.filter((c) => palavras.every((p) => semAcento(c.nome).includes(p)));
}

function tabelaResumo(r: ResumoPainel): string {
  const linhas: [string, string][] = [
    ["Confirmadas", String(r.pessoas_confirmadas)],
    ["Faltando", String(r.pessoas_faltando)],
    ["Esperadas", String(r.pessoas_esperadas)],
  ];
  return "```\n" + linhas.map(([a, b]) => `${a.padEnd(12)}${b.padStart(5)}`).join("\n") + "\n```";
}

export function textoResumoConvidados(r: ResumoPainel): string {
  const pct = r.pessoas_esperadas ? Math.round((r.pessoas_confirmadas / r.pessoas_esperadas) * 100) : 0;
  return cartao(
    "*Convidados*",
    [
      `${pct}% das pessoas confirmadas`,
      "",
      tabelaResumo(r),
      `Convites: ${r.convites_confirmados} confirmados · ${r.convites_pendentes} pendentes (de ${r.convites})`,
      r.confirmacoes_sem_vinculo ? `_${r.confirmacoes_sem_vinculo} confirmação(ões) do site sem convite vinculado (vincule no painel, aba RSVP)_` : null,
    ],
    "Listas: confirmados · pendentes convidados · faltando",
  );
}

const linhaConvite = (c: ConvitePainel) =>
  `- ${c.nome} · ${c.quantidade_confirmada}/${c.quantidade_esperada}${c.faltam && c.quantidade_confirmada ? ` _(faltam ${c.faltam})_` : ""} _#${c.id}_`;

export function textoListaConvidados(lista: ConvitePainel[], status: string): string {
  const titulo = status === "confirmados" ? "Confirmados" : status === "pendentes" ? "Ainda não confirmaram" : status === "faltando" ? "Faltando confirmar pessoas" : "Todos os convites";
  const total = lista.reduce((s, c) => s + (status === "confirmados" ? c.quantidade_confirmada : status === "todos" ? c.quantidade_esperada : c.faltam), 0);
  const LIM = 40;
  return cartao(
    `*${titulo}* · ${lista.length} convite(s)`,
    lista.length
      ? [`${pessoas(total)}`, "", ...lista.slice(0, LIM).map(linhaConvite), lista.length > LIM ? `_+${lista.length - LIM} no painel_` : null]
      : ["Nenhum convite nessa lista."],
    "Detalhe: convidado <nome> · remover: remover convidado <nome>",
  );
}

export function textoConvite(c: ConvitePainel): string {
  return cartao(
    `*${c.nome}* _#${c.id}_`,
    [
      `${c.confirmado ? "✓ Confirmado" : "○ Pendente"} · ${c.quantidade_confirmada} de ${c.quantidade_esperada}${c.faltam ? ` (faltam ${c.faltam})` : ""}`,
      c.grupo ? `Grupo: ${c.grupo}` : null,
      c.telefone ? `Telefone: ${c.telefone}` : null,
      c.observacoes ? `> ${c.observacoes}` : null,
      ...(c.confirmacoes_site.length ? ["", "*Confirmações pelo site*", ...c.confirmacoes_site.map((r) => `- ${r.nome}: ${pessoas(r.quantidade)}${r.mensagem ? ` _"${r.mensagem.slice(0, 80)}"_` : ""}`)] : []),
    ],
  );
}

export function textoNovoConvite(c: ConvitePainel): string {
  return cartao("*Convite adicionado*", [`*${c.nome}* · ${pessoas(c.quantidade_esperada)}${c.telefone ? ` · ${c.telefone}` : ""}`, `_#${c.id} no painel_`], `Errou? Mande remover convidado ${c.id}`);
}

/** Mensagem no grupo quando alguém confirma pelo site (uma ou várias de uma vez). */
export function textoAvisoConfirmacoes(avisos: AvisoConfirmacao[], resumo: ResumoPainel | null): string {
  const corpo: string[] = [];
  for (const a of avisos) {
    const r = a.confirmacao;
    corpo.push(`*${r.nome}* confirmou ${pessoas(r.quantidade)}`);
    if (a.convite) {
      const c = a.convite;
      corpo.push(`Convite ${c.nome}: ${c.quantidade_confirmada} de ${c.quantidade_esperada}${c.faltam ? ` (faltam ${c.faltam})` : " (completo)"}`);
    } else corpo.push("_Não bateu com nenhum convite da lista: vincule no painel, aba RSVP_");
    if (r.mensagem) corpo.push(`> ${r.mensagem.replace(/\s+/g, " ").slice(0, 200)}`);
    corpo.push("");
  }
  if (resumo) corpo.push(`Total: *${resumo.pessoas_confirmadas}* confirmadas · ${resumo.pessoas_faltando} faltando`);
  return cartao(avisos.length > 1 ? `*${avisos.length} novas confirmações de presença*` : "*Nova confirmação de presença*", corpo, "Mande convidados para ver o resumo");
}
