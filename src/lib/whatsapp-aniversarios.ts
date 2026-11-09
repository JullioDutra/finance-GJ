// Comandos de aniversário pelo WhatsApp:
//   aniversário tia Ana 15/03[/1970]      -> cadastra
//   aniversários                           -> próximos (lista)
//   aniversário Ana                        -> quando é
//   apagar aniversário Ana                 -> remove
//   aniversários + uma pessoa por linha    -> cadastra vários ("Ana 15/03")

import type { Aniversario, Banco } from "./types";
import { novoId, semAcento } from "./format";
import { rotuloDia } from "./agenda";
import { lerDataAniversario, proximaData, proximosAniversarios, relacaoPorTexto, textoIdade, idadeEm } from "./aniversarios";
import { cartao, type BotaoWhats, type PedidoImagem } from "./whatsapp-modelos";
import type { Op } from "./ops";

interface Resultado {
  ok: boolean;
  ops: Op[];
  resposta: string;
  botoes?: BotaoWhats[];
  reagir?: string;
  imagem?: PedidoImagem;
}

const PREFIXOS = ["aniversarios", "aniversario", "aniversariantes", "nivers", "niver"];
const PREFIXOS_APAGAR = ["apagar aniversario", "remover aniversario", "excluir aniversario", "apagar niver", "remover niver"];
const BT_ANIV: BotaoWhats = { id: "aniversarios", texto: "Aniversários" };

function tirar(texto: string, prefixos: string[]): string | null {
  const n = semAcento(texto);
  for (const p of [...prefixos].sort((x, y) => y.length - x.length)) if (n === p || n.startsWith(p + " ") || n.startsWith(p + ":")) return texto.slice(p.length).replace(/^[\s:]+/, "").trim();
  return null;
}

const capitalizar = (t: string) => t.replace(/(^|\s)(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());

/** "tia Ana 15/03/1970" -> { nome: "Tia Ana", data, ano } */
function lerLinha(linha: string): { nome: string; data: string; ano?: number } | null {
  const tokens = linha.replace(/^[-•*\s]+/, "").split(/\s+/).filter(Boolean);
  const idx = tokens.findIndex((t) => lerDataAniversario(t.replace(/[,;:]$/, "")));
  if (idx < 0) return null;
  const d = lerDataAniversario(tokens[idx].replace(/[,;:]$/, ""))!;
  const nome = tokens
    .filter((_, i) => i !== idx)
    .join(" ")
    .replace(/^(de|da|do|dia)\s+/i, "")
    .replace(/\s+(dia|em|no dia|-|—)$/i, "")
    .replace(/[,;:\-—]+$/, "")
    .trim();
  if (!nome) return null;
  return { nome: capitalizar(nome.slice(0, 60)), ...d };
}

function novo(b: Banco, l: { nome: string; data: string; ano?: number }): Aniversario | null {
  if ((b.aniversarios ?? []).some((a) => semAcento(a.nome) === semAcento(l.nome) && a.data === l.data)) return null;
  return { id: novoId(), nome: l.nome, data: l.data, ...(l.ano ? { ano: l.ano } : {}), relacao: relacaoPorTexto(l.nome), observacao: "" };
}

const dataBR = (md: string) => `${md.slice(3)}/${md.slice(0, 2)}`;

export function processarAniversarios(b: Banco, textoOriginal: string, hoje: string): Resultado | null {
  const linhas = textoOriginal.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const texto = linhas.join(" ").replace(/\s+/g, " ");

  // vários de uma vez: "aniversários" + uma pessoa por linha
  if (linhas.length >= 2 && tirar(linhas[0], PREFIXOS) !== null) {
    const primeira = tirar(linhas[0], PREFIXOS)!;
    const itens = (primeira ? [primeira, ...linhas.slice(1)] : linhas.slice(1)).map((l) => ({ l, r: lerLinha(l) }));
    const ops: Op[] = [];
    const novos: Aniversario[] = [];
    let base = b;
    for (const { r } of itens) {
      if (!r) continue;
      const a = novo(base, r);
      if (!a) continue;
      novos.push(a);
      ops.push({ tipo: "upsert", colecao: "aniversarios", id: a.id, dados: a });
      base = { ...base, aniversarios: [...(base.aniversarios ?? []), a] };
    }
    const ruins = itens.filter((i) => !i.r).map((i) => i.l);
    if (!novos.length) return { ok: false, ops: [], resposta: cartao("*Nenhum aniversário novo*", ["Formato: um por linha, ex.: `Tia Ana 15/03`", ...(ruins.length ? ["", "_Não entendi:_ " + ruins.join(", ")] : [])]) };
    return {
      ok: true,
      ops,
      resposta: cartao(
        `*${novos.length} aniversário(s) salvos*`,
        [...novos.map((a) => `- ${a.nome} · ${dataBR(a.data)}`), ...(ruins.length ? ["", "_Sem data, não salvei:_ " + ruins.join(", ")] : [])],
        "Vou avisar no grupo no dia de cada um",
      ),
      botoes: [BT_ANIV],
      reagir: ruins.length ? undefined : "✅",
    };
  }

  // apagar
  const apagar = tirar(texto, PREFIXOS_APAGAR);
  if (apagar !== null) {
    const alvo = semAcento(apagar);
    const achados = (b.aniversarios ?? []).filter((a) => alvo && semAcento(a.nome).includes(alvo));
    if (achados.length !== 1) {
      return { ok: false, ops: [], resposta: cartao(achados.length ? "*Qual deles?*" : "*Não encontrei esse aniversário*", achados.length ? achados.slice(0, 8).map((a) => `- ${a.nome} · ${dataBR(a.data)}`) : ["Mande `aniversários` para ver a lista."]) };
    }
    return { ok: true, ops: [{ tipo: "delete", colecao: "aniversarios", id: achados[0].id }], resposta: cartao("*Aniversário removido*", [`~${achados[0].nome}~ · ${dataBR(achados[0].data)}`]), reagir: "✅" };
  }

  const resto = tirar(texto, PREFIXOS);
  if (resto === null) return null;

  // listar
  if (!resto || ["proximos", "do mes", "mes"].includes(semAcento(resto))) {
    const prox = proximosAniversarios(b, hoje, 60);
    return {
      ok: true,
      ops: [],
      resposta: cartao(
        "*Próximos aniversários*",
        prox.length ? prox.slice(0, 15).map((p) => `- *${p.dias === 0 ? "hoje" : rotuloDia(p.data, hoje)}* — ${p.aniversario.nome}${p.idade ? ` _(${textoIdade(p.idade)})_` : ""}`) : [(b.aniversarios ?? []).length ? "Nenhum nos próximos 60 dias." : "Nenhum aniversário cadastrado ainda."],
        "Para cadastrar: aniversário tia Ana 15/03",
      ),
      imagem: { tipo: "aniversarios" },
    };
  }

  // cadastrar
  const l = lerLinha(resto);
  if (l) {
    const a = novo(b, l);
    if (!a) return { ok: false, ops: [], resposta: cartao("*Esse aniversário já está salvo*", [`- ${l.nome} · ${dataBR(l.data)}`]) };
    const data = proximaData(a, hoje);
    const idade = idadeEm(a, data);
    return {
      ok: true,
      ops: [{ tipo: "upsert", colecao: "aniversarios", id: a.id, dados: a }],
      resposta: cartao("*Aniversário salvo*", [`*${a.nome}* · ${dataBR(a.data)}`, `Próximo: ${rotuloDia(data, hoje)}${idade ? ` · faz ${idade} anos` : ""}`], "Vou avisar no grupo no dia"),
      botoes: [BT_ANIV],
      reagir: "✅",
    };
  }

  // consultar: "aniversário Ana"
  const alvo = semAcento(resto);
  const achados = (b.aniversarios ?? []).filter((a) => semAcento(a.nome).includes(alvo));
  if (!achados.length) return { ok: false, ops: [], resposta: cartao("*Não encontrei*", [`Nenhum aniversário com "${resto}".`, "Para cadastrar: `aniversário tia Ana 15/03`"]) };
  return {
    ok: true,
    ops: [],
    resposta: cartao(
      "*Aniversário*",
      achados.slice(0, 8).map((a) => {
        const d = proximaData(a, hoje);
        const idade = idadeEm(a, d);
        return `- *${a.nome}* · ${dataBR(a.data)} _(${d === hoje ? "hoje!" : rotuloDia(d, hoje)}${idade ? ` · ${textoIdade(idade)}` : ""})_`;
      }),
    ),
  };
}
