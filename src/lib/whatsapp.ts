// Interpreta mensagens enviadas pelo WhatsApp e transforma em operações.
// Usado tanto pelo webhook (/api/whatsapp) quanto pelo simulador na tela de Ajustes.

import type { Banco, Categoria, PessoaId, TipoLancamento } from "./types";
import { dinheiro, isoDe, mesDe, nomeMes, parseValor, semAcento } from "./format";
import { contasDoMes, planoCasamento, resumoMes, totaisContas } from "./calc";
import { opNovoLancamento, opsPagarConta, type Op } from "./ops";

export const AJUDA_WHATSAPP = `*Como lançar pelo WhatsApp* 💬

*Começar:* \`iniciar finanças\` · *Sair:* \`encerrar\`

*Gasto:* \`mercado 154,90\` ou \`gastei 45 uber\`
*Receita:* \`recebi 3500 salário\` ou \`+3500 salário\`
*Guardar p/ casamento:* \`guardei 500\`
*Conta do dia 6:* \`paguei luz\` (ou \`paguei luz 187,30\`)
*Data:* termine com \`ontem\` ou \`12/03\`
*De quem:* inclua \`casal\` para lançar como do casal

*Consultas:* \`resumo\`, \`contas\`, \`casamento\`, \`ajuda\``;

export interface ResultadoMensagem {
  ops: Op[];
  resposta: string;
  ok: boolean;
}

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
  const fim = (s: string) => s.replace(/\D/g, "").slice(-8);
  const t = fim(telefone);
  if (t.length < 8) return null;
  if (fim(b.config.telefoneP1) === t) return "p1";
  if (fim(b.config.telefoneP2) === t) return "p2";
  return null;
}

export function processarMensagem(b: Banco, textoOriginal: string, pessoaPadrao: PessoaId, hoje: string): ResultadoMensagem {
  const texto = textoOriginal.trim().replace(/\s+/g, " ");
  const norm = semAcento(texto);
  const mes = mesDe(hoje);

  if (!texto || ["ajuda", "help", "menu", "?", "oi", "ola"].includes(norm)) {
    return { ops: [], resposta: AJUDA_WHATSAPP, ok: true };
  }

  if (["resumo", "saldo", "mes", "extrato"].includes(norm)) {
    const r = resumoMes(b, mes);
    const top = r.porCategoria.slice(0, 3).map((c) => `• ${c.categoria.nome}: ${dinheiro(c.total)}`).join("\n");
    return {
      ok: true,
      ops: [],
      resposta:
        `*Resumo de ${nomeMes(mes)}*\n` +
        `💰 Receitas: ${dinheiro(r.receitas)}\n` +
        `💸 Gastos: ${dinheiro(r.despesas)}\n` +
        `💒 Guardado: ${dinheiro(r.guardado)}\n` +
        `📊 Sobra: ${dinheiro(r.sobra)}\n` +
        `🏠 Custo da casa: ${dinheiro(r.casa)}` +
        (top ? `\n\n*Mais gastos:*\n${top}` : ""),
    };
  }

  if (["contas", "dia 6", "dia6", "pendentes", "boletos"].includes(norm)) {
    const lista = contasDoMes(b, mes, hoje);
    const t = totaisContas(lista);
    if (!lista.length) return { ok: true, ops: [], resposta: "Nenhuma conta fixa cadastrada ainda. Cadastre em *Dia 6* no app." };
    const linhas = lista.map((c) => `${c.pago ? "✅" : c.atrasada ? "⚠️" : "⬜"} ${c.conta.nome} — ${dinheiro(c.valor)}`).join("\n");
    return { ok: true, ops: [], resposta: `*Contas de ${nomeMes(mes)}* (${t.qtdPagas}/${t.qtd} pagas)\n${linhas}\n\nFalta pagar: *${dinheiro(t.falta)}*` };
  }

  if (["casamento", "reserva", "fornecedores"].includes(norm)) {
    const p = planoCasamento(b, mes);
    return {
      ok: true,
      ops: [],
      resposta:
        `*Casamento* 💍\n` +
        `Guardado disponível: ${dinheiro(p.disponivel)}\n` +
        `Já pago aos fornecedores: ${dinheiro(p.totalPago)}\n` +
        `Falta pagar: ${dinheiro(p.totalRestante)}\n` +
        `Dá para quitar agora: ${p.daParaPagar.length} fornecedor(es)\n` +
        `Falta guardar: *${dinheiro(p.faltaGuardar)}*`,
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
        resposta: `✅ Conta *${conta.nome}* marcada como paga em ${nomeMes(mesConta)} (${dinheiro(v)}).`,
      };
    }
  }

  if (Number.isNaN(valor)) {
    return { ok: false, ops: [], resposta: `Não entendi o valor 🤔\n\n${AJUDA_WHATSAPP}` };
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
  if (!categoria) return { ok: false, ops: [], resposta: "Nenhuma categoria encontrada para esse tipo. Cadastre em Ajustes." };

  const op = opNovoLancamento({
    data,
    tipo,
    valor,
    categoriaId: categoria.id,
    descricao: descricao || categoria.nome,
    pessoa,
    origem: "whatsapp",
  });
  const rotulo = tipo === "receita" ? "Receita" : tipo === "guardado" ? "Guardado" : "Gasto";
  return {
    ok: true,
    ops: [op],
    resposta:
      `✅ *${rotulo} registrado*\n` +
      `${categoria.nome} — *${dinheiro(valor)}*\n` +
      `📝 ${descricao || categoria.nome}\n` +
      `👤 ${nomePessoa(b, pessoa)} · 📅 ${data.split("-").reverse().join("/")}`,
  };
}
