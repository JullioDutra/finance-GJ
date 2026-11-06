// Comandos de agenda pelo WhatsApp:
//   agenda [hoje|amanhã|semana|15/11|sexta]   -> lista compromissos
//   marcar <quando> <hora> <o quê>             -> adiciona (ex.: "marcar sexta 19h dentista")
//   desmarcar <o quê> [quando]                 -> remove
//   buscar <palavra>                            -> pesquisa em todas as datas

import type { AreaEvento, Banco, Evento, PessoaId, Tarefa } from "./types";
import { novoId, semAcento } from "./format";
import { areaPorTitulo, buscarNaAgenda, extrairData, extrairHora, itensAgenda, rotuloDia, somarDias, tipoPorTitulo, type ItemAgenda } from "./agenda";
import { cartao, type BotaoWhats, type PedidoImagem } from "./whatsapp-modelos";
import { checklistTarefas, type ItemChecklist } from "./tarefas";
import type { Op } from "./ops";

interface Resultado {
  ok: boolean;
  ops: Op[];
  resposta: string;
  botoes?: BotaoWhats[];
  reagir?: string;
  imagem?: PedidoImagem;
}

const BT_AG = {
  hoje: { id: "agenda hoje", texto: "Hoje" },
  amanha: { id: "agenda amanhã", texto: "Amanhã" },
  semana: { id: "agenda semana", texto: "Semana" },
  desmarcar: (id: string): BotaoWhats => ({ id: `desmarcar-id ${id}`, texto: "Desfazer" }),
};

const EMOJI_TIPO: Record<string, string> = {
  reuniao: "🤝", prova: "🍰", visita: "📍", pagamento: "💸", consulta: "🩺", trabalho: "💼", social: "🎉", viagem: "✈️", lembrete: "🔔", outro: "📌",
  fornecedor: "💸", tarefa: "📋", conta: "🧾", casamento: "💍",
};

const nomeP = (b: Banco, p: PessoaId) => (p === "p1" ? b.config.nomeP1 : p === "p2" ? b.config.nomeP2 : "");

function linhaItem(b: Banco, i: ItemAgenda, comDia: boolean, hoje: string): string {
  const quando = [comDia ? rotuloDia(i.data, hoje) : "", i.hora].filter(Boolean).join(" · ");
  const quem = nomeP(b, i.pessoa);
  const extra = [i.evento?.local, quem].filter(Boolean).join(" · ");
  return `- ${quando ? `*${quando}* — ` : ""}${i.titulo}${extra ? ` _(${extra})_` : ""}`;
}

const PREFIXOS_FEITO = ["feito", "feita", "feitos", "feitas", "fiz", "concluir", "concluido", "concluida", "conclui", "terminei", "check"];

function barraTexto(f: number, n = 10): string {
  const cheios = Math.round(Math.max(0, Math.min(1, f)) * n);
  return "▰".repeat(cheios) + "▱".repeat(n - cheios);
}

function linhaTarefa(it: ItemChecklist, hoje: string): string {
  const prazo = it.tarefa.prazo ? (it.situacao === "atrasada" ? ` · *atrasada (${rotuloDia(it.tarefa.prazo, hoje)})*` : ` _· até ${rotuloDia(it.tarefa.prazo, hoje)}_`) : "";
  return `${it.n}. ☐ ${it.tarefa.titulo}${prazo}`;
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
      resposta: cartao(titulo, linhas.length ? linhas : ["Nada marcado."], "Para marcar: marcar sexta 19h dentista"),
      imagem: { tipo: "agenda", de, ate, titulo: titulo.replace(/\*/g, "").replace(/^[^\p{L}]+/u, "") },
      botoes: [arg === "amanha" || arg === "amanhã" ? BT_AG.hoje : BT_AG.amanha, BT_AG.semana, { id: "ajuda", texto: "Ajuda" }],
    };
  }

  // ----- tarefas do casamento (checklist numerado) -----
  if (norm === "tarefas" || norm === "pendencias" || norm === "checklist" || norm === "lista de tarefas") {
    const ck = checklistTarefas(b, hoje);
    const corpo: string[] = [`${barraTexto(ck.total ? ck.feitas / ck.total : 0)}  ${ck.feitas} de ${ck.total} feitas`];
    let mostradas = 0;
    for (const g of ck.grupos) {
      if (mostradas >= 15) break;
      corpo.push("", `*${g.grupo}*`);
      for (const it of g.itens) {
        if (mostradas++ >= 15) break;
        corpo.push(linhaTarefa(it, hoje));
      }
    }
    if (!ck.itens.length) corpo.push("", ck.total ? "*Tudo feito!*" : "Nenhuma tarefa ainda.");
    if (ck.itens.length > 15) corpo.push("", `_+${ck.itens.length - 15} no app (Casamento → Tarefas)_`);
    return {
      ok: true,
      ops: [],
      resposta: cartao(`*Tarefas do casamento* · ${ck.itens.length} pendente(s)`, corpo, ck.itens.length ? "Para marcar como feita: feito 3 (ou feito 2 5 7)" : "Para adicionar: tarefa <o quê>"),
      botoes: [BT_AG.hoje, BT_AG.semana],
      imagem: { tipo: "tarefas" },
    };
  }

  // ----- marcar tarefa como feita: "feito 3", "feito 2 5 7", "feito convites" -----
  const feito = tirarPrefixo(texto, PREFIXOS_FEITO);
  if (feito !== null) {
    const ck = checklistTarefas(b, hoje);
    const numeros = feito.match(/^[\d\s,e]+$/i) ? [...new Set((feito.match(/\d+/g) ?? []).map(Number))] : [];
    let alvos: ItemChecklist[] = [];
    if (numeros.length) {
      if (numeros.some((n) => n < 1 || n > ck.itens.length)) {
        if (/^fiz\b/i.test(semAcento(texto))) return null; // "fiz 50" pode ser outra coisa
        return { ok: false, ops: [], resposta: cartao("*Número não encontrado*", [`Há ${ck.itens.length} tarefa(s) pendente(s).`, "Mande `tarefas` para ver a lista numerada."]) };
      }
      alvos = numeros.map((n) => ck.itens[n - 1]);
    } else if (feito) {
      const alvo = semAcento(feito);
      alvos = ck.itens.filter((i) => semAcento(i.tarefa.titulo).includes(alvo));
      if (alvos.length > 1) alvos = alvos.filter((i) => semAcento(i.tarefa.titulo) === alvo).length ? alvos.filter((i) => semAcento(i.tarefa.titulo) === alvo) : alvos;
      if (!alvos.length) {
        if (/^fiz\b/i.test(semAcento(texto))) return null;
        return { ok: false, ops: [], resposta: cartao("*Não encontrei essa tarefa*", ["Mande `tarefas` e use o número: `feito 3`."]) };
      }
      if (alvos.length > 1) {
        return { ok: false, ops: [], resposta: cartao("*Qual delas?*", [...alvos.slice(0, 8).map((i) => linhaTarefa(i, hoje)), "", `Mande \`feito ${alvos[0].n}\`, por exemplo.`]) };
      }
    } else {
      return { ok: false, ops: [], resposta: cartao("*Qual tarefa?*", ["Mande `tarefas` para ver a lista e depois `feito 3`."]) };
    }
    const restantes = ck.itens.length - alvos.length;
    return {
      ok: true,
      ops: alvos.map((i): Op => ({ tipo: "upsert", colecao: "tarefas", id: i.tarefa.id, dados: { ...i.tarefa, feita: true } })),
      resposta: cartao(
        alvos.length > 1 ? `*${alvos.length} tarefas feitas*` : "*Tarefa feita*",
        [...alvos.map((i) => `✓ ~${i.tarefa.titulo}~`), "", restantes ? `Faltam ${restantes} · ${ck.feitas + alvos.length} de ${ck.total} feitas` : "*Todas as tarefas feitas!*"],
        "Marcou errado? Mande reabrir e o nome",
      ),
      botoes: [{ id: `reabrir-id ${alvos.map((i) => i.tarefa.id).join(",")}`, texto: "Desfazer" }, { id: "tarefas", texto: "Tarefas" }],
      reagir: "✅",
    };
  }

  // ----- reabrir tarefa: "reabrir convites" ou botão "reabrir-id <ids>" -----
  if (norm.startsWith("reabrir-id ")) {
    const ids = texto.split(" ")[1]?.split(",") ?? [];
    const ts = b.tarefas.filter((t) => ids.includes(t.id) && t.feita);
    if (!ts.length) return { ok: false, ops: [], resposta: cartao("*Nada para desfazer*", ["Essas tarefas já estão pendentes."]) };
    return { ok: true, ops: ts.map((t): Op => ({ tipo: "upsert", colecao: "tarefas", id: t.id, dados: { ...t, feita: false } })), resposta: cartao("*Tarefa reaberta*", ts.map((t) => `☐ ${t.titulo}`)), reagir: "✅" };
  }
  const reabrir = tirarPrefixo(texto, ["reabrir", "reabre", "desmarcar tarefa"]);
  if (reabrir) {
    const alvo = semAcento(reabrir);
    const ts = b.tarefas.filter((t) => t.feita && semAcento(t.titulo).includes(alvo));
    if (ts.length !== 1) {
      return { ok: false, ops: [], resposta: cartao(ts.length ? "*Qual delas?*" : "*Não encontrei essa tarefa feita*", ts.length ? ts.slice(0, 8).map((t) => `✓ ${t.titulo}`) : ["Confira o nome em Casamento → Tarefas."], ts.length ? "Mande o nome mais completo" : undefined) };
    }
    const t = ts[0];
    return { ok: true, ops: [{ tipo: "upsert", colecao: "tarefas", id: t.id, dados: { ...t, feita: false } }], resposta: cartao("*Tarefa reaberta*", [`☐ ${t.titulo}`]), reagir: "✅" };
  }

  const novaTarefa = tirarPrefixo(texto, ["tarefa", "nova tarefa", "anotar tarefa"]);
  if (novaTarefa) {
    const { data, resto } = extrairData(novaTarefa, hoje);
    const titulo = resto.replace(/^[\s:;,\-–—]+/, "").replace(/\s+(ate|até|para|pra|no dia|dia|em)$/i, "").trim();
    if (titulo) {
      if (b.tarefas.some((t) => semAcento(t.titulo) === semAcento(titulo))) {
        return { ok: false, ops: [], resposta: cartao("📝 *Essa tarefa já existe*", [`• ${titulo}`]) };
      }
      const t: Tarefa = { id: novoId(), titulo: titulo.charAt(0).toUpperCase() + titulo.slice(1), grupo: grupoDaTarefa(titulo), responsavel: "casal", prazo: data ?? "", feita: false, observacao: "" };
      return {
        ok: true,
        ops: [{ tipo: "upsert", colecao: "tarefas", id: t.id, dados: t }],
        resposta: cartao("*Tarefa anotada*", [`☐ *${t.titulo}*`, `${t.grupo}${t.prazo ? ` · até ${rotuloDia(t.prazo, hoje)}` : ""}`], "Veja em Casamento → Tarefas"),
        botoes: [{ id: "tarefas", texto: "Tarefas" }, BT_AG.semana],
        reagir: "✅",
      };
    }
  }

  // ----- buscar -----
  const termoBusca = tirarPrefixo(texto, PREFIXOS_BUSCAR);
  if (termoBusca !== null) {
    if (!termoBusca) return { ok: false, ops: [], resposta: cartao("🔎 *O que buscar?*", ["Ex.: `buscar dentista`, `buscar buffet`"]) };
    const achados = buscarNaAgenda(itensAgenda(b, { hoje }), termoBusca, hoje);
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
      ...(achados.length ? { imagem: { tipo: "busca" as const, termo: termoBusca } } : {}),
    };
  }

  // ----- desfazer marcação (botão) -----
  if (norm.startsWith("desmarcar-id ")) {
    const id = texto.split(" ")[1];
    const ev = b.eventos.find((e) => e.id === id);
    if (!ev) return { ok: false, ops: [], resposta: cartao("↩️ *Nada para desfazer*", ["Esse compromisso já foi removido."]) };
    return { ok: true, ops: [{ tipo: "delete", colecao: "eventos", id }], resposta: cartao("*Compromisso removido*", [`~${ev.titulo}~ · ${rotuloDia(ev.data, hoje)}`]), botoes: [BT_AG.hoje, BT_AG.semana], reagir: "✅" };
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
      resposta: cartao("*Compromisso removido*", [`~${ev.titulo}~`, `_${rotuloDia(ev.data, hoje)}${ev.hora ? " · " + ev.hora : ""}_`], "Mande agenda para ver o que ficou"),
      botoes: [BT_AG.hoje, BT_AG.semana],
      reagir: "✅",
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
      botoes: [BT_AG.desmarcar(ev.id), { id: `agenda ${ev.data.slice(8)}/${ev.data.slice(5, 7)}`, texto: "Ver o dia" }, BT_AG.semana],
      reagir: "✅",
    };
  }

  return null;
}

// =====================================================================
// LISTA: vários compromissos/tarefas numa mensagem só (uma linha por item)
// =====================================================================

const GRUPO_TAREFA: [string[], string][] = [
  [["cartorio", "batisterio", "documento", "certidao", "habilitacao", "curso de noivos"], "Documentos"],
  [["convite", "convidado", "lista", "rsvp", "save the date"], "Convidados"],
  [["pajem", "pajens", "daminha", "padrinho", "madrinha", "alianca", "igreja", "paroquia", "cerimonia"], "Cerimônia"],
  [["vestido", "terno", "traje", "sapato", "cabelo", "maquiagem"], "Trajes"],
  [["buffet", "festa", "bolo", "doce", "dj", "banda", "salao", "bebida"], "Festa"],
  [["foto", "fotografo", "filmagem", "decoracao", "flores", "fornecedor", "cerimonial"], "Fornecedores"],
  [["prestacao", "pagar", "pagamento", "site", "orcamento", "gasto"], "Planejamento"],
];

function grupoDaTarefa(titulo: string): string {
  const t = ` ${semAcento(titulo)}`;
  for (const [ps, g] of GRUPO_TAREFA) if (ps.some((p) => t.includes(` ${p}`))) return g;
  return "Planejamento";
}

const limparLinha = (l: string) =>
  l
    .replace(/^[\s•·*\-–—>→.]+/, "")
    .replace(/^-+>\s*/, "")
    .trim();

const capitalizar = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const INICIO_MARCAR = new Set(["marcar", "agendar", "agenda", "compromissos", "marcar compromissos"]);
const INICIO_TAREFAS = new Set(["tarefa", "tarefas", "pra fazer", "para fazer", "a fazer"]);

const comecaComData = (l: string) => /^\d{1,2}\/\d{1,2}/.test(limparLinha(l));

export function processarLista(b: Banco, textoOriginal: string, pessoa: PessoaId, hoje: string): Resultado | null {
  const linhas = textoOriginal.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (linhas.length < 2) return null;
  const primeira = semAcento(limparLinha(linhas[0])).replace(/[:.!]+$/, "").trim();
  let modo: "marcar" | "tarefas";
  let itens = linhas;
  if (INICIO_MARCAR.has(primeira)) {
    modo = "marcar";
    itens = linhas.slice(1);
  } else if (INICIO_TAREFAS.has(primeira)) {
    modo = "tarefas";
    itens = linhas.slice(1);
  } else if ([...INICIO_MARCAR].some((p) => primeira.startsWith(p + " ")) && linhas.slice(1).some(comecaComData)) {
    // "marcar 20/12 prova\n21/12 degustação": o primeiro item veio na mesma linha do comando
    modo = "marcar";
    const p = [...INICIO_MARCAR].filter((x) => primeira.startsWith(x + " ")).sort((x, y) => y.length - x.length)[0];
    itens = [limparLinha(linhas[0]).slice(p.length).trim(), ...linhas.slice(1)];
  } else if (linhas.filter(comecaComData).length >= 2) {
    modo = "marcar";
  } else return null;

  const lote = novoId();
  const agora = new Date().toISOString();
  const ops: Op[] = [];
  const marcados: { secao: string; ev: Evento }[] = [];
  const tarefasNovas: Tarefa[] = [];
  const semData: string[] = [];
  let repetidos = 0;
  let secao = "";
  let areaSecao: AreaEvento | null = null;

  for (const bruta of itens) {
    const linha = limparLinha(bruta);
    if (!linha) continue;
    // título de seção: "Faculdade:", "Casamento:", "Igreja:"...
    if (/^[^\d:]{2,40}:$/.test(linha)) {
      secao = capitalizar(linha.slice(0, -1).trim());
      areaSecao = areaPorTitulo(secao) === "casamento" ? "casamento" : "casal";
      continue;
    }
    const d = modo === "marcar" ? extrairData(linha, hoje) : extrairData(linha, hoje);
    const h = extrairHora(d.resto);
    const titulo = capitalizar(h.resto.replace(/^[\s:;,\-–—]+/, "").replace(/\s+/g, " ").trim());
    if (!titulo) continue;
    const area: AreaEvento = areaSecao ?? areaPorTitulo(titulo);

    // sem data (ou modo tarefas): do casamento vira tarefa; o resto é avisado
    if (!d.data || modo === "tarefas") {
      if (modo === "tarefas" || area === "casamento") {
        const ja = [...b.tarefas, ...tarefasNovas].some((t) => semAcento(t.titulo) === semAcento(titulo));
        if (ja) {
          repetidos++;
          continue;
        }
        const t: Tarefa = { id: novoId(), titulo, grupo: grupoDaTarefa(titulo), responsavel: "casal", prazo: d.data ?? "", feita: false, observacao: secao, lote };
        tarefasNovas.push(t);
        ops.push({ tipo: "upsert", colecao: "tarefas", id: t.id, dados: t });
      } else semData.push(titulo);
      continue;
    }

    const ja = [...b.eventos, ...marcados.map((m) => m.ev)].some((e) => e.data === d.data && semAcento(e.titulo) === semAcento(titulo));
    if (ja) {
      repetidos++;
      continue;
    }
    let tipo = tipoPorTitulo(titulo);
    if (tipo === "outro" && /faculdade|escola|curso|trabalho/.test(semAcento(secao))) tipo = "trabalho";
    const ev: Evento = {
      id: novoId(),
      titulo,
      data: d.data,
      hora: h.hora,
      local: "",
      tipo,
      observacao: secao,
      area,
      pessoa: area === "casamento" ? "casal" : pessoa,
      origem: "whatsapp",
      criadoEm: agora,
      lote,
    };
    marcados.push({ secao, ev });
    ops.push({ tipo: "upsert", colecao: "eventos", id: ev.id, dados: ev });
  }

  if (!ops.length) {
    return {
      ok: false,
      ops: [],
      resposta: cartao(
        "📋 *Nada novo na lista*",
        [repetidos ? `Os ${repetidos} item(ns) já estavam cadastrados.` : "Não achei itens com data.", ...(semData.length ? ["", "_Sem data:_ " + semData.join(", ")] : [])],
        "Formato: uma linha por item, ex.: 15/11 19h dentista",
      ),
    };
  }

  const corpo: string[] = [];
  if (marcados.length) {
    corpo.push(`✅ *${marcados.length} compromisso(s) na agenda*`);
    let s = "\u0000";
    for (const m of [...marcados].sort((x, y) => x.secao.localeCompare(y.secao) || (x.ev.data + x.ev.hora).localeCompare(y.ev.data + y.ev.hora))) {
      if (m.secao !== s) {
        s = m.secao;
        if (s) corpo.push(`*${s}*`);
      }
      corpo.push(`• ${rotuloDia(m.ev.data, hoje)}${m.ev.hora ? " " + m.ev.hora : ""} — ${m.ev.titulo}`);
    }
  }
  if (tarefasNovas.length) {
    if (corpo.length) corpo.push("");
    corpo.push(`📝 *${tarefasNovas.length} tarefa(s) do casamento*`);
    for (const t of tarefasNovas) corpo.push(`• ${t.titulo}${t.prazo ? ` _(até ${rotuloDia(t.prazo, hoje)})_` : ""}`);
  }
  if (semData.length) {
    corpo.push("", `⏭️ *Sem data — não marquei:*`, ...semData.map((x) => `• ${x}`));
  }
  if (repetidos) corpo.push("", `_${repetidos} item(ns) já estavam cadastrados e não foram repetidos._`);

  return {
    ok: true,
    ops,
    resposta: cartao("📋 *Lista adicionada*", corpo, semData.length ? "Para os sem data: marcar <dia> <o quê>" : "Errou algo? Mande desfazer lista"),
    botoes: [{ id: `desmarcar-lote ${lote}`, texto: "Desfazer tudo" }, BT_AG.semana, BT_AG.hoje],
    imagem: { tipo: "lista", lote, semData, repetidos },
  };
}

/** Remove tudo que foi criado numa lista ("desmarcar-lote <id>"). */
export function desfazerLote(b: Banco, texto: string, hoje: string): Resultado | null {
  const n = semAcento(texto);
  let lote: string | undefined;
  if (n.startsWith("desmarcar-lote ")) lote = texto.split(" ")[1];
  else if (n === "desfazer lista" || n === "desfazer tudo") {
    // última lista mandada pelo WhatsApp
    lote = [...b.eventos].reverse().filter((e) => e.lote).sort((x, y) => (y.criadoEm ?? "").localeCompare(x.criadoEm ?? ""))[0]?.lote ?? [...b.tarefas].reverse().find((t) => t.lote)?.lote;
    if (!lote) return { ok: false, ops: [], resposta: cartao("↩️ *Nenhuma lista para desfazer*", ["Não encontrei listas mandadas pelo WhatsApp."]) };
  } else return null;
  const evs = b.eventos.filter((e) => e.lote === lote);
  const tfs = b.tarefas.filter((t) => t.lote === lote);
  if (!evs.length && !tfs.length) return { ok: false, ops: [], resposta: cartao("↩️ *Nada para desfazer*", ["Essa lista já foi removida."]) };
  return {
    ok: true,
    ops: [...evs.map((e): Op => ({ tipo: "delete", colecao: "eventos", id: e.id })), ...tfs.map((t): Op => ({ tipo: "delete", colecao: "tarefas", id: t.id }))],
    resposta: cartao("🗑️ *Lista desfeita*", [`Removi ${evs.length} compromisso(s)${tfs.length ? ` e ${tfs.length} tarefa(s)` : ""}.`], `Hoje é ${rotuloDia(hoje, hoje)}`),
    botoes: [BT_AG.hoje, BT_AG.semana],
    reagir: "✅",
  };
}
