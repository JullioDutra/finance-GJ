// Interpreta mensagens enviadas pelo WhatsApp e transforma em operações.
// Usado tanto pelo webhook (/api/whatsapp) quanto pelo simulador na tela de Ajustes.

import type { Banco, Categoria, PessoaId, TipoLancamento } from "./types";
import { dataCurta, diasEntre, dinheiro, isoDe, mesDe, nomeMes, parseValor, semAcento, somarMeses } from "./format";
import { contasDoMes, planoCasamento, resumoMes, totaisContas, variacao } from "./calc";
import { opNovoLancamento, opsDesfazerConta, opsPagarConta, type Op } from "./ops";
import { desfazerLote, processarAgenda, processarLista } from "./whatsapp-agenda";
import { rotuloDia } from "./agenda";
import { barra, BT, cartao, emojiCategoria, MSG_AJUDA, pctTexto, tabela, type BotaoWhats, type PedidoImagem } from "./whatsapp-modelos";

export const AJUDA_WHATSAPP = MSG_AJUDA;

export interface ResultadoMensagem {
  ops: Op[];
  resposta: string;
  ok: boolean;
  /** botões de resposta rápida (opcional; o texto sozinho continua completo) */
  botoes?: BotaoWhats[];
  /** quando der certo: só reagir na mensagem (ex.: "✅") em vez de responder em texto */
  reagir?: string;
  /** consultas: mandar como cartão em imagem (o texto vira a reserva se a imagem falhar) */
  imagem?: PedidoImagem;
}

export type { PedidoImagem } from "./whatsapp-modelos";

const PALAVRAS_RECEITA = ["recebi", "receita", "entrada", "ganhei", "salario", "+"];
const PALAVRAS_GUARDAR = ["guardei", "guardar", "reservei", "poupei", "investi", "aporte"];
const PALAVRAS_GASTO = ["gastei", "paguei", "comprei", "gasto", "despesa", "-"];
const RUIDO = new Set(["no", "na", "nos", "nas", "de", "do", "da", "em", "com", "pra", "para", "o", "a", "reais", "real", "r$", "rs"]);

function detectarData(tokens: string[], hoje: string): { data: string; resto: string[] } {
  const resto: string[] = [];
  let data = hoje;
  for (const t of tokens) {
    const n = semAcento(t);
    if (n === "ontem") {
      const d = new Date(hoje + "T12:00:00");
      d.setDate(d.getDate() - 1);
      data = isoDe(d);
      continue;
    }
    if (n === "hoje") continue;
    const m = n.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (m) {
      const ano = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : Number(hoje.slice(0, 4));
      data = `${ano}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      continue;
    }
    resto.push(t);
  }
  return { data, resto };
}

export function acharCategoria(categorias: Categoria[], tipo: TipoLancamento, texto: string): Categoria | undefined {
  const alvo = ` ${semAcento(texto)} `;
  const doTipo = categorias.filter((c) => c.tipo === tipo);
  let melhor: { c: Categoria; tam: number } | undefined;
  for (const c of doTipo) {
    const termos = [c.nome, ...c.palavras.split(",")]
      .map((p) => semAcento(p.trim()))
      .filter((p) => p.length >= 2);
    for (const termo of termos) {
      const nomeSimples = termo.split(/[\s/]+/)[0];
      for (const t of [termo, nomeSimples]) {
        if (t.length >= 2 && alvo.includes(` ${t}`) && (!melhor || t.length > melhor.tam)) melhor = { c, tam: t.length };
      }
    }
  }
  if (melhor) return melhor.c;
  if (tipo === "despesa") return doTipo.find((c) => c.id === "cat-outros") ?? doTipo[doTipo.length - 1];
  if (tipo === "receita") return doTipo.find((c) => c.id === "cat-outras-receitas") ?? doTipo[0];
  return doTipo[0];
}

export function nomePessoa(b: Banco, p: PessoaId): string {
  return p === "p1" ? b.config.nomeP1 : p === "p2" ? b.config.nomeP2 : "Casal";
}

/** Descobre quem mandou pelo número (compara os últimos 8 dígitos). */
export function pessoaPorTelefone(b: Banco, telefone: string): PessoaId {
  return identificarPessoa(b, telefone) ?? "casal";
}

/**
 * Só aceita os números cadastrados em Ajustes (nunca pelo nome do perfil, que qualquer um pode copiar).
 * Devolve null quando não é nenhum de vocês dois.
 */
export function identificarPessoa(b: Banco, telefone: string): "p1" | "p2" | null {
  const so = (s: string) => s.replace(/\D/g, "");
  const completo = so(telefone);
  const t = completo.slice(-8);
  if (t.length < 8) return null;
  if (so(b.config.telefoneP1).slice(-8) === t) return "p1";
  if (so(b.config.telefoneP2).slice(-8) === t) return "p2";
  // IDs aprovados manualmente em Ajustes (comparação exata)
  if ((b.config.whatsappExtraP1 ?? []).some((x) => so(x) === completo)) return "p1";
  if ((b.config.whatsappExtraP2 ?? []).some((x) => so(x) === completo)) return "p2";
  return null;
}

export function processarMensagem(b: Banco, textoOriginal: string, pessoaPadrao: PessoaId, hoje: string): ResultadoMensagem {
  // lista com várias linhas (compromissos/tarefas de uma vez)
  const lista = processarLista(b, textoOriginal, pessoaPadrao, hoje);
  if (lista) return lista;
  const texto = textoOriginal.trim().replace(/\s+/g, " ");
  const lote = desfazerLote(b, texto, hoje);
  if (lote) return lote;
  const norm = semAcento(texto);
  const mes = mesDe(hoje);

  if (!texto || ["ajuda", "help", "menu", "?", "oi", "ola"].includes(norm)) {
    return { ops: [], resposta: AJUDA_WHATSAPP, ok: true, botoes: [BT.resumo, BT.contas, BT.encerrar], imagem: { tipo: "ajuda" } };
  }

  // desfazer: "desfazer <id>" (botão) ou "desfazer" (último lançamento pelo WhatsApp desta pessoa, hoje)
  // agenda: agenda / marcar / desmarcar / buscar
  const agenda = processarAgenda(b, texto, pessoaPadrao, hoje);
  if (agenda) return agenda;

  if (norm === "desfazer" || norm.startsWith("desfazer ")) {
    const id = texto.split(" ")[1];
    // "desfazer" sem id: se a última coisa feita pelo WhatsApp foi um compromisso, desfaz ele
    if (!id) {
      // (reverse: em empate de horário, o mais recente da lista vence)
      const ultimoEv = [...b.eventos]
        .reverse()
        .filter((e) => e.origem === "whatsapp" && (e.criadoEm ?? "").slice(0, 10) >= hoje.slice(0, 10))
        .sort((x, y) => (y.criadoEm ?? "").localeCompare(x.criadoEm ?? ""))[0];
      const ultimoLanc = [...b.lancamentos]
        .reverse()
        .filter((l) => (l.origem === "whatsapp" || l.origem === "conta_fixa") && l.data === hoje && l.pessoa === pessoaPadrao)
        .sort((x, y) => (y.criadoEm ?? "").localeCompare(x.criadoEm ?? ""))[0];
      if (ultimoEv && (!ultimoLanc || (ultimoEv.criadoEm ?? "") > (ultimoLanc.criadoEm ?? ""))) {
        return {
          ok: true,
          ops: [{ tipo: "delete", colecao: "eventos", id: ultimoEv.id }],
          resposta: cartao("*Compromisso removido*", [`~${ultimoEv.titulo}~ · ${rotuloDia(ultimoEv.data, hoje)}`]),
          botoes: [{ id: "agenda hoje", texto: "Hoje" }, { id: "agenda semana", texto: "Semana" }],
          reagir: "✅",
        };
      }
    }
    const alvo = id
      ? b.lancamentos.find((l) => l.id === id)
      : [...b.lancamentos]
          .reverse()
          .filter((l) => (l.origem === "whatsapp" || l.origem === "conta_fixa") && l.data === hoje && l.pessoa === pessoaPadrao)
          .sort((x, y) => (y.criadoEm ?? "").localeCompare(x.criadoEm ?? ""))[0];
    if (!alvo) {
      return { ok: false, ops: [], resposta: cartao("↩️ *Nada para desfazer*", ["Esse lançamento já foi removido ou não foi feito pelo WhatsApp."], "Ajustes manuais: Lançamentos no app"), botoes: [BT.resumo, BT.encerrar] };
    }
    const cat = b.categorias.find((c) => c.id === alvo.categoriaId);
    const ops: Op[] = alvo.contaId && alvo.mes ? opsDesfazerConta(b, alvo.contaId, alvo.mes) : [{ tipo: "delete", colecao: "lancamentos", id: alvo.id }];
    return {
      ok: true,
      ops,
      resposta: cartao("*Lançamento desfeito*", [`~${cat?.nome ?? ""} · ${alvo.descricao} · ${dinheiro(alvo.valor)}~`, alvo.contaId ? "_A conta voltou para pendente._" : null], "Pode lançar de novo com o valor certo"),
      botoes: [BT.resumo, BT.contas, BT.encerrar],
      reagir: "✅",
    };
  }

  const mesNome = nomeMes(mes).split(" ")[0].toLowerCase();

  if (["resumo", "saldo", "mes", "extrato"].includes(norm)) {
    const r = resumoMes(b, mes);
    const ant = resumoMes(b, somarMeses(mes, -1));
    const vCasa = variacao(r.casa, ant.casa);
    const top = r.porCategoria.slice(0, 3).map((c, i) => `${i + 1}. ${c.categoria.nome} — ${dinheiro(c.total)}`);
    return {
      ok: true,
      ops: [],
      resposta: cartao(
        `📊 *Resumo de ${mesNome}*`,
        [
          tabela([
            ["Receitas", dinheiro(r.receitas)],
            ["Gastos", dinheiro(r.despesas)],
            ["Guardado", dinheiro(r.guardado)],
            "---",
            ["Sobra", dinheiro(r.sobra)],
          ]),
          r.receitas > 0 ? `> Gastaram *${pctTexto(r.despesas / r.receitas)}* da renda e guardaram *${pctTexto(r.guardado / r.receitas)}*` : null,
          "",
          `🏠 *Custo da casa:* ${dinheiro(r.casa)}${vCasa !== null ? ` _(${vCasa >= 0 ? "▲" : "▼"} ${pctTexto(Math.abs(vCasa))} vs mês anterior)_` : ""}`,
          top.length ? "" : null,
          top.length ? "*Onde mais gastaram*" : null,
          ...top,
        ],
        "Detalhes e gráficos no app",
      ),
      botoes: [BT.contas, BT.casamento, BT.encerrar],
      imagem: { tipo: "resumo", mes },
    };
  }

  if (["contas", "dia 6", "dia6", "pendentes", "boletos"].includes(norm)) {
    const lista = contasDoMes(b, mes, hoje);
    const t = totaisContas(lista);
    if (!lista.length) {
      return { ok: true, ops: [], resposta: cartao(`🗓️ *Contas do dia ${b.config.diaPadraoContas}*`, ["Nenhuma conta fixa cadastrada ainda.", "_Cadastre em *Dia 6* no app._"]), botoes: [BT.resumo, BT.casamento, BT.encerrar] };
    }
    const linhas = lista.map((c) =>
      c.pago
        ? `✓ ~${c.conta.nome}~ · ${dinheiro(c.valor)}`
        : `○ ${c.conta.nome} · ${dinheiro(c.valor)}${c.atrasada ? " · *atrasada*" : ` _(vence ${dataCurta(c.vencimento)})_`}`,
    );
    return {
      ok: true,
      ops: [],
      resposta: cartao(
        `🗓️ *Contas do dia ${b.config.diaPadraoContas} · ${mesNome}*`,
        [`${barra(t.qtd ? t.qtdPagas / t.qtd : 0)}  ${t.qtdPagas} de ${t.qtd} pagas`, "", ...linhas, "", t.falta > 0 ? `Falta pagar: *${dinheiro(t.falta)}*` : "*Tudo pago este mês.*"],
        "Para marcar como paga: paguei luz",
      ),
      botoes: [BT.resumo, BT.casamento, BT.encerrar],
      imagem: { tipo: "contas", mes },
    };
  }

  if (["casamento", "reserva", "fornecedores"].includes(norm)) {
    const p = planoCasamento(b, mes);
    const dias = b.config.dataCasamento ? diasEntre(hoje, b.config.dataCasamento) : null;
    return {
      ok: true,
      ops: [],
      resposta: cartao(
        `💍 *Casamento${dias !== null && dias >= 0 ? ` · faltam ${dias} dias` : ""}*`,
        [
          tabela([
            ["Contratado", dinheiro(p.totalContratado)],
            ["Já pago", dinheiro(p.totalPago)],
            ["Falta pagar", dinheiro(p.totalRestante)],
            "---",
            ["Reserva hoje", dinheiro(p.disponivel)],
            ["Falta guardar", dinheiro(p.faltaGuardar)],
          ]),
          p.totalContratado > 0 ? `${barra(p.totalPago / p.totalContratado)}  ${pctTexto(p.totalPago / p.totalContratado)} pago` : null,
          "",
          `✅ Dá para pagar agora: *${p.daParaPagar.length}* fornecedor(es) · ${dinheiro(p.valorDaParaPagar)}`,
          `⏳ Ainda falta dinheiro: *${p.faltam.length}* fornecedor(es)`,
          p.mesesRestantes > 0 && p.faltaGuardar > 0 ? `> Guardando *${dinheiro(p.precisaPorMes)}/mês* vocês quitam tudo até o casamento` : null,
        ],
        "Lista completa em Casamento → Fornecedores",
      ),
      botoes: [BT.resumo, BT.contas, BT.encerrar],
      imagem: { tipo: "casamento" },
    };
  }

  // --- lançamentos ---
  let tokens = texto.split(" ");
  // "+3500" / "-45"
  let sinal: "" | "+" | "-" = "";
  if (/^[+-]/.test(tokens[0]) && tokens[0].length > 1) {
    sinal = tokens[0][0] as "+" | "-";
    tokens[0] = tokens[0].slice(1);
  }
  const { data, resto } = detectarData(tokens, hoje);
  tokens = resto;

  // valor: primeiro token numérico
  let valor = NaN;
  const semValor: string[] = [];
  for (const t of tokens) {
    if (Number.isNaN(valor) && /\d/.test(t) && /^(r\$)?[\d.,]+$/i.test(t.replace(/^r\$/i, ""))) {
      const v = parseValor(t);
      if (!Number.isNaN(v) && v > 0) { valor = v; continue; }
    }
    semValor.push(t);
  }

  let pessoa = pessoaPadrao;
  const palavras = semValor.filter((t) => {
    const n = semAcento(t);
    if (n === "casal") { pessoa = "casal"; return false; }
    return true;
  });
  const primeiro = semAcento(palavras[0] ?? "");

  // "paguei luz" -> conta fixa
  if (primeiro === "paguei" && palavras.length > 1) {
    const alvo = semAcento(palavras.slice(1).join(" "));
    const conta = b.contas.find((c) => c.ativa && (semAcento(c.nome).includes(alvo) || alvo.includes(semAcento(c.nome))));
    if (conta) {
      const mesConta = mesDe(data);
      const v = Number.isNaN(valor) ? conta.valor : valor;
      return {
        ok: true,
        ops: opsPagarConta(conta, mesConta, v, data),
        resposta: (() => {
          const pend = contasDoMes(b, mesConta, hoje).filter((c) => !c.pago && c.conta.id !== conta.id);
          return cartao(
            "✅ *Conta paga*",
            [
              `🗓️ *${conta.nome}* · ${dinheiro(v)}`,
              `_${nomeMes(mesConta)}_`,
              "",
              pend.length ? `Ainda faltam *${pend.length}* conta(s): ${dinheiro(pend.reduce((x, c) => x + c.valor, 0))}` : "🎉 *Todas as contas do mês estão pagas!*",
            ],
            "Mande contas para ver a lista",
          );
        })(),
        botoes: [BT.desfazer(`lc-${conta.id}-${mesConta}`), BT.contas, BT.encerrar],
        reagir: "✅",
      };
    }
  }

  if (Number.isNaN(valor)) {
    return {
      ok: false,
      ops: [],
      resposta: cartao("🤔 *Não entendi o valor*", ["Tente assim:", "🛒 `mercado 154,90`", "💰 `recebi 3500 salário`"], "Mande ajuda para ver todos os comandos"),
      botoes: [BT.ajuda, BT.resumo, BT.encerrar],
    };
  }

  let tipo: TipoLancamento = "despesa";
  if (sinal === "+" || PALAVRAS_RECEITA.includes(primeiro)) tipo = "receita";
  else if (PALAVRAS_GUARDAR.includes(primeiro)) tipo = "guardado";
  else if (sinal === "-" || PALAVRAS_GASTO.includes(primeiro)) tipo = "despesa";

  const descPalavras = palavras.filter((t, i) => {
    const n = semAcento(t);
    if (i === 0 && [...PALAVRAS_RECEITA, ...PALAVRAS_GUARDAR, ...PALAVRAS_GASTO].includes(n)) return false;
    return !RUIDO.has(n);
  });
  const descricao = descPalavras.join(" ");
  const categoria = acharCategoria(b.categorias, tipo, descricao || (tipo === "guardado" ? "reserva" : ""));
  if (!categoria) return { ok: false, ops: [], resposta: cartao("⚠️ *Sem categoria*", ["Nenhuma categoria encontrada para esse tipo.", "_Cadastre em Ajustes no app._"]) };

  const op = opNovoLancamento({
    data,
    tipo,
    valor,
    categoriaId: categoria.id,
    descricao: descricao || categoria.nome,
    pessoa,
    origem: "whatsapp",
  });
  const rotulo = tipo === "receita" ? "Receita registrada" : tipo === "guardado" ? "Guardado para o casamento" : "Gasto registrado";
  const icone = tipo === "receita" ? "💰" : tipo === "guardado" ? "🐷" : "✅";
  // contexto do mês já contando este lançamento
  const r = resumoMes(b, mesDe(data));
  const totalTipo = (tipo === "receita" ? r.receitas : tipo === "guardado" ? r.guardado : r.despesas) + valor;
  const rotuloTotal = tipo === "receita" ? "Receitas" : tipo === "guardado" ? "Guardado" : "Gastos";
  const sobra = r.sobra + (tipo === "receita" ? valor : -valor);
  return {
    ok: true,
    ops: [op],
    resposta: cartao(
      `${icone} *${rotulo}*`,
      [
        `${emojiCategoria(categoria)} *${categoria.nome}* · *${dinheiro(valor)}*`,
        descricao && semAcento(descricao) !== semAcento(categoria.nome) ? `> ${descricao}` : null,
        `👤 ${nomePessoa(b, pessoa)}   📅 ${dataCurta(data)}`,
        "",
        tabela([
          [`${rotuloTotal} de ${nomeMes(mesDe(data)).split(" ")[0].toLowerCase()}`, dinheiro(totalTipo)],
          ["Sobra do mês", dinheiro(sobra)],
        ]),
      ],
      "Errou? Mande desfazer",
    ),
    botoes: [BT.desfazer(op.id), BT.resumo, BT.encerrar],
    reagir: "✅",
  };
}
