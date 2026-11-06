// Comandos de agenda pelo WhatsApp:
//   agenda [hoje|amanhã|semana|15/11|sexta]   -> lista compromissos
//   marcar <quando> <hora> <o quê>             -> adiciona (ex.: "marcar sexta 19h dentista")
//   desmarcar <o quê> [quando]                 -> remove
//   buscar <palavra>                            -> pesquisa em todas as datas

import type { Banco, Evento, PessoaId } from "./types";
import { novoId, semAcento } from "./format";
import { areaPorTitulo, buscarNaAgenda, extrairData, extrairHora, itensAgenda, rotuloDia, somarDias, tipoPorTitulo, type ItemAgenda } from "./agenda";
import { cartao, type BotaoWhats } from "./whatsapp-modelos";
import type { Op } from "./ops";

interface Resultado {
  ok: boolean;
  ops: Op[];
  resposta: string;
  botoes?: BotaoWhats[];
}

const BT_AG = {
  hoje: { id: "agenda hoje", texto: "📅 Hoje" },
  amanha: { id: "agenda amanhã", texto: "📅 Amanhã" },
  semana: { id: "agenda semana", texto: "🗓️ Semana" },
  desmarcar: (id: string): BotaoWhats => ({ id: `desmarcar-id ${id}`, texto: "↩️ Desfazer" }),
};

const EMOJI_TIPO: Record<string, string> = {
  reuniao: "🤝", prova: "🍰", visita: "📍", pagamento: "💸", consulta: "🩺", trabalho: "💼", social: "🎉", viagem: "✈️", lembrete: "🔔", outro: "📌",
  fornecedor: "💸", tarefa: "📋", conta: "🧾", casamento: "💍",
};

const nomeP = (b: Banco, p: PessoaId) => (p === "p1" ? b.config.nomeP1 : p === "p2" ? b.config.nomeP2 : "");

function linhaItem(b: Banco, i: ItemAgenda, comDia: boolean, hoje: string): string {
  const emoji = EMOJI_TIPO[i.evento?.tipo ?? i.tipo] ?? "📌";
  const quando = [comDia ? rotuloDia(i.data, hoje) : "", i.hora].filter(Boolean).join(" · ");
  const quem = nomeP(b, i.pessoa);
  const extra = [i.evento?.local, quem].filter(Boolean).join(" · ");
  return `${emoji} ${quando ? `*${quando}* — ` : ""}${i.titulo}${extra ? ` _(${extra})_` : ""}`;
}

const PREFIXOS_MARCAR = ["marcar", "marca", "marque", "agendar", "agende", "agenda:", "novo compromisso"];
const PREFIXOS_DESMARCAR = ["desmarcar", "desmarca", "cancelar compromisso", "remover compromisso", "apagar compromisso"];
const PREFIXOS_BUSCAR = ["buscar", "busca", "procurar", "pesquisar"];

function tirarPrefixo(texto: string, prefixos: string[]): string | null {
  const n = semAcento(texto);
  for (const p of prefixos) if (n === p || n.startsWith(p + " ")) return texto.slice(p.length).trim();
  return null;
}

export function processarAgenda(b: Banco, texto: string, pessoa: PessoaId, hoje: string): Resultado | null {
  const norm = semAcento(texto);

  // ----- listar -----
  if (norm === "agenda" || norm.startsWith("agenda ") || norm === "compromissos") {
    const arg = norm.replace(/^(agenda|compromissos)\s*/, "");
    const itens = itensAgenda(b, { hoje });
    let de = hoje;
    let ate = hoje;
    let titulo = "📅 *Agenda de hoje*";
    if (arg === "semana" || arg === "da semana" || arg === "proximos dias") {
      ate = somarDias(hoje, 6);
      titulo = "🗓️ *Próximos 7 dias*";
    } else if (arg && arg !== "hoje") {
      const { data } = extrairData(arg, hoje);
      if (!data) return { ok: false, ops: [], resposta: cartao("🤔 *Não entendi o dia*", ["Tente: `agenda amanhã`, `agenda sexta`, `agenda 15/11` ou `agenda semana`."]) };
      de = ate = data;
      titulo = `📅 *Agenda de ${rotuloDia(data, hoje)}*`;
    }
    const doPeriodo = itens.filter((i) => i.data >= de && i.data <= ate);
    const multiDia = de !== ate;
    const linhas: string[] = [];
    let diaAtual = "";
    for (const i of doPeriodo) {
      if (multiDia && i.data !== diaAtual) {
        if (linhas.length) linhas.push("");
        linhas.push(`*${rotuloDia(i.data, hoje)}*`);
        diaAtual = i.data;
      }
      linhas.push(linhaItem(b, i, false, hoje));
    }
    return {
      ok: true,
      ops: [],
      resposta: cartao(titulo, linhas.length ? linhas : ["Nada marcado. 🙌"], "Para marcar: marcar sexta 19h dentista"),
      botoes: [arg === "amanha" || arg === "amanhã" ? BT_AG.hoje : BT_AG.amanha, BT_AG.semana, { id: "ajuda", texto: "📖 Ajuda" }],
    };
  }

  // ----- buscar -----
  const termoBusca = tirarPrefixo(texto, PREFIXOS_BUSCAR);
  if (termoBusca !== null) {
    if (!termoBusca) return { ok: false, ops: [], resposta: cartao("🔎 *O que buscar?*", ["Ex.: `buscar dentista`, `buscar buffet`"]) };
    const achados = buscarNaAgenda(itensAgenda(b, { hoje }), termoBusca);
    const futuros = achados.filter((i) => i.data >= hoje);
    const passados = achados.filter((i) => i.data < hoje).reverse();
    const linhas = [
      ...futuros.slice(0, 8).map((i) => linhaItem(b, i, true, hoje)),
      ...(passados.length ? ["", "_Já passaram:_", ...passados.slice(0, 3).map((i) => linhaItem(b, i, true, hoje))] : []),
    ];
    return {
      ok: true,
      ops: [],
      resposta: cartao(`🔎 *Busca: ${termoBusca}*`, achados.length ? linhas : ["Nenhum compromisso encontrado."], achados.length > 11 ? "Veja todos em Agenda → Buscar no app" : undefined),
      botoes: [BT_AG.hoje, BT_AG.semana],
    };
  }

  // ----- desfazer marcação (botão) -----
  if (norm.startsWith("desmarcar-id ")) {
    const id = texto.split(" ")[1];
    const ev = b.eventos.find((e) => e.id === id);
    if (!ev) return { ok: false, ops: [], resposta: cartao("↩️ *Nada para desfazer*", ["Esse compromisso já foi removido."]) };
    return { ok: true, ops: [{ tipo: "delete", colecao: "eventos", id }], resposta: cartao("🗑️ *Compromisso removido*", [`~${ev.titulo}~ · ${rotuloDia(ev.data, hoje)}`]), botoes: [BT_AG.hoje, BT_AG.semana] };
  }

  // ----- desmarcar -----
  const alvoTexto = tirarPrefixo(texto, PREFIXOS_DESMARCAR);
  if (alvoTexto !== null) {
    const { data, resto } = extrairData(alvoTexto, hoje);
    const termo = resto.trim();
    let candidatos = b.eventos.filter((e) => e.data >= hoje);
    if (data) candidatos = candidatos.filter((e) => e.data === data);
    if (termo) {
      const ps = semAcento(termo).split(/\s+/);
      candidatos = candidatos.filter((e) => ps.every((p) => semAcento(`${e.titulo} ${e.local}`).includes(p)));
    }
    candidatos.sort((x, y) => (x.data + x.hora).localeCompare(y.data + y.hora));
    if (!termo && !data) return { ok: false, ops: [], resposta: cartao("🤔 *Qual compromisso?*", ["Ex.: `desmarcar dentista` ou `desmarcar dentista sexta`"]) };
    if (!candidatos.length) return { ok: false, ops: [], resposta: cartao("🔎 *Não encontrei*", ["Nenhum compromisso futuro com esse nome.", "_Use `buscar` para procurar._"]) };
    if (candidatos.length > 1) {
      return {
        ok: false,
        ops: [],
        resposta: cartao(
          "🤔 *Encontrei mais de um*",
          [...candidatos.slice(0, 6).map((e) => `• ${rotuloDia(e.data, hoje)}${e.hora ? " " + e.hora : ""} — ${e.titulo}`), "", "Diga o dia, ex.: `desmarcar " + (termo || "dentista") + " " + candidatos[0].data.slice(8) + "/" + candidatos[0].data.slice(5, 7) + "`"],
        ),
      };
    }
    const ev = candidatos[0];
    return {
      ok: true,
      ops: [{ tipo: "delete", colecao: "eventos", id: ev.id }],
      resposta: cartao("🗑️ *Compromisso removido*", [`~${ev.titulo}~`, `_${rotuloDia(ev.data, hoje)}${ev.hora ? " · " + ev.hora : ""}_`], "Mande agenda para ver o que ficou"),
      botoes: [BT_AG.hoje, BT_AG.semana],
    };
  }

  // ----- marcar -----
  const novo = tirarPrefixo(texto, PREFIXOS_MARCAR);
  if (novo !== null) {
    const d = extrairData(novo, hoje);
    const h = extrairHora(d.resto);
    let titulo = h.resto.replace(/^(o|a|um|uma)\s+/i, "").trim();
    let quem: PessoaId | null = null;
    // "casal" / "nós" no texto => do casal
    titulo = titulo
      .split(" ")
      .filter((t) => {
        const n = semAcento(t);
        if (n === "casal" || n === "nos") {
          quem = "casal";
          return false;
        }
        return true;
      })
      .join(" ");
    if (!d.data || !titulo) {
      return {
        ok: false,
        ops: [],
        resposta: cartao("🤔 *Faltou o dia ou o que é*", ["Exemplos:", "`marcar sexta 19h dentista`", "`marcar 15/11 10:30 degustação buffet`", "`marcar amanhã aniversário da mãe`"]),
      };
    }
    const area = areaPorTitulo(titulo);
    const ev: Evento = {
      id: novoId(),
      titulo: titulo.charAt(0).toUpperCase() + titulo.slice(1),
      data: d.data,
      hora: h.hora,
      local: "",
      tipo: tipoPorTitulo(titulo),
      observacao: "",
      area,
      pessoa: quem ?? (area === "casamento" ? "casal" : pessoa),
      origem: "whatsapp",
      criadoEm: new Date().toISOString(),
    };
    const mesmoDia = b.eventos.filter((e) => e.data === ev.data).sort((x, y) => (x.hora || "99").localeCompare(y.hora || "99"));
    return {
      ok: true,
      ops: [{ tipo: "upsert", colecao: "eventos", id: ev.id, dados: ev }],
      resposta: cartao(
        "📅 *Compromisso marcado*",
        [
          `${EMOJI_TIPO[ev.tipo]} *${ev.titulo}*`,
          `🗓️ ${rotuloDia(ev.data, hoje)}${ev.hora ? ` · ${ev.hora}` : " · sem horário"}`,
          `🏷️ ${area === "casamento" ? "Casamento" : "Dia a dia"}${nomeP(b, ev.pessoa!) ? ` · ${nomeP(b, ev.pessoa!)}` : " · Casal"}`,
          mesmoDia.length ? "" : null,
          mesmoDia.length ? `_Também neste dia: ${mesmoDia.map((e) => `${e.hora ? e.hora + " " : ""}${e.titulo}`).join(", ")}_` : null,
        ],
        "Errou? Mande desfazer ou desmarcar",
      ),
      botoes: [BT_AG.desmarcar(ev.id), { id: `agenda ${ev.data.slice(8)}/${ev.data.slice(5, 7)}`, texto: "📅 Ver o dia" }, BT_AG.semana],
    };
  }

  return null;
}
