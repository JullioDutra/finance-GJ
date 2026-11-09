// "Bom dia" das 7h: compromissos de hoje, aniversários e o Radar do casal
// (alertas inteligentes: ritmo de gastos, atrasos, meta de guardar e marcos do casamento).
// Função pura: o texto e o cartão em imagem usam os mesmos dados.

import type { Banco } from "./types";
import { itensAgenda, rotuloDia, somarDias, type ItemAgenda } from "./agenda";
import { contasDoMes, planoCasamento, resumoMes } from "./calc";
import { diasEntre, dinheiro, mesDe, nomeMes, somarMeses } from "./format";
import { proximosAniversarios, textoIdade, type ProximoAniversario } from "./aniversarios";
import { checklistTarefas } from "./tarefas";
import { cartao } from "./whatsapp-modelos";

export type TomAlerta = "bom" | "atencao" | "alerta" | "info";
export type IconeAlerta = "ritmo" | "conta" | "tarefa" | "meta" | "fornecedor" | "semana";

export interface AlertaRadar {
  tom: TomAlerta;
  icone: IconeAlerta;
  texto: string;
}

export interface BomDia {
  hoje: string;
  saudacao: string;
  dataExtenso: string;
  diasCasamento: number | null;
  /** marco especial da contagem regressiva (ex.: 100), quando hoje é um */
  marco: number | null;
  compromissos: ItemAgenda[];
  aniversariosHoje: ProximoAniversario[];
  aniversariosEmBreve: ProximoAniversario[];
  radar: AlertaRadar[];
  segunda: boolean;
}

const MARCOS = new Set([365, 300, 250, 200, 150, 100, 90, 60, 50, 45, 30, 21, 15, 14, 10, 7, 5, 3, 2, 1, 0]);
const SEMANA_EXT = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const MESES_EXT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const diasNoMes = (mes: string) => new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).getDate();
const pct = (v: number) => `${Math.round(Math.abs(v) * 100)}%`;
const mesCurto = (mes: string) => nomeMes(mes).split(" ")[0].toLowerCase();

function gastosEntre(b: Banco, de: string, ate: string) {
  const ls = b.lancamentos.filter((l) => l.tipo === "despesa" && l.data >= de && l.data <= ate);
  const porCat = new Map<string, number>();
  for (const l of ls) porCat.set(l.categoriaId, (porCat.get(l.categoriaId) ?? 0) + l.valor);
  const top = [...porCat.entries()].sort((x, y) => y[1] - x[1])[0];
  return { total: ls.reduce((s, l) => s + l.valor, 0), topCategoria: top ? (b.categorias.find((c) => c.id === top[0])?.nome ?? "") : "" };
}

/** Alertas do Radar do casal (no máximo 4, do mais importante ao menos). */
export function radarDoCasal(b: Banco, hoje: string): AlertaRadar[] {
  const alertas: AlertaRadar[] = [];
  const mes = mesDe(hoje);
  const dia = Number(hoje.slice(8, 10));
  const segunda = new Date(hoje + "T12:00:00").getDay() === 1;

  // contas atrasadas / vencendo hoje
  const contas = contasDoMes(b, mes, hoje).filter((c) => !c.pago);
  const atrasadas = contas.filter((c) => c.atrasada);
  const venceHoje = contas.filter((c) => c.vencimento === hoje);
  if (atrasadas.length) {
    alertas.push({ tom: "alerta", icone: "conta", texto: `${atrasadas.length === 1 ? `A conta ${atrasadas[0].conta.nome} está atrasada` : `${atrasadas.length} contas atrasadas`} (${dinheiro(atrasadas.reduce((s, c) => s + c.valor, 0))})` });
  } else if (venceHoje.length) {
    alertas.push({ tom: "atencao", icone: "conta", texto: `Vence hoje: ${venceHoje.map((c) => c.conta.nome).join(", ")} (${dinheiro(venceHoje.reduce((s, c) => s + c.valor, 0))})` });
  }

  // ritmo de gastos do mês x mês anterior
  if (dia >= 10) {
    const atual = resumoMes(b, mes).despesas;
    const anterior = resumoMes(b, somarMeses(mes, -1)).despesas;
    if (atual > 0 && anterior > 0) {
      const projecao = (atual / dia) * diasNoMes(mes);
      const v = projecao / anterior - 1;
      if (v > 0.1) alertas.push({ tom: "atencao", icone: "ritmo", texto: `No ritmo atual, ${mesCurto(mes)} fecha com ${dinheiro(projecao)} de gastos: ${pct(v)} acima de ${mesCurto(somarMeses(mes, -1))}` });
      else if (v < -0.1) alertas.push({ tom: "bom", icone: "ritmo", texto: `Gastos ${pct(v)} abaixo do ritmo de ${mesCurto(somarMeses(mes, -1))}. Continuem assim!` });
    }
  }

  // tarefas do casamento atrasadas
  const tarefasAtrasadas = checklistTarefas(b, hoje).itens.filter((i) => i.situacao === "atrasada");
  if (tarefasAtrasadas.length) {
    alertas.push({ tom: "atencao", icone: "tarefa", texto: tarefasAtrasadas.length === 1 ? `Tarefa atrasada: ${tarefasAtrasadas[0].tarefa.titulo}` : `${tarefasAtrasadas.length} tarefas do casamento atrasadas` });
  }

  // meta de guardar (da metade do mês em diante)
  const meta = b.config.metaMensalGuardar;
  if (meta > 0 && dia >= 15) {
    const guardado = resumoMes(b, mes).guardado;
    if (guardado < meta) alertas.push({ tom: "info", icone: "meta", texto: `Faltam ${dinheiro(meta - guardado)} para a meta de guardar ${dinheiro(meta)} este mês` });
    else if (dia <= 16 || segunda) alertas.push({ tom: "bom", icone: "meta", texto: `Meta de guardar do mês batida (${dinheiro(guardado)})` });
  }

  // segunda-feira: como foi a semana e fornecedores que já dá para pagar
  if (segunda) {
    const semana = gastosEntre(b, somarDias(hoje, -7), somarDias(hoje, -1));
    const antes = gastosEntre(b, somarDias(hoje, -14), somarDias(hoje, -8));
    if (semana.total > 0) {
      const v = antes.total > 0 ? semana.total / antes.total - 1 : null;
      alertas.push({
        tom: v !== null && v > 0.15 ? "atencao" : "info",
        icone: "semana",
        texto: `Semana passada: ${dinheiro(semana.total)} em gastos${semana.topCategoria ? `, mais em ${semana.topCategoria}` : ""}${v !== null && Math.abs(v) >= 0.05 ? ` (${v > 0 ? "+" : "−"}${pct(v)})` : ""}`,
      });
    }
    const plano = planoCasamento(b, mes);
    if (plano.daParaPagar.length) {
      alertas.push({ tom: "bom", icone: "fornecedor", texto: `A reserva já cobre ${plano.daParaPagar.length} fornecedor(es): ${dinheiro(plano.valorDaParaPagar)}` });
    }
  }

  const peso: Record<TomAlerta, number> = { alerta: 0, atencao: 1, info: 2, bom: 3 };
  return alertas.sort((x, y) => peso[x.tom] - peso[y.tom]).slice(0, 4);
}

export function montarBomDia(b: Banco, hoje: string): BomDia {
  const d = new Date(hoje + "T12:00:00");
  const diasCasamento = b.config.dataCasamento ? diasEntre(hoje, b.config.dataCasamento) : null;
  const aniversarios = proximosAniversarios(b, hoje, 7);
  const nomes = [b.config.nomeP1, b.config.nomeP2].filter(Boolean).join(" e ");
  return {
    hoje,
    saudacao: d.getDay() === 1 ? `Bom dia e boa semana${nomes ? `, ${nomes}` : ""}` : `Bom dia${nomes ? `, ${nomes}` : ""}`,
    dataExtenso: `${SEMANA_EXT[d.getDay()]}, ${d.getDate()} de ${MESES_EXT[d.getMonth()]}`,
    diasCasamento,
    marco: diasCasamento !== null && MARCOS.has(diasCasamento) ? diasCasamento : null,
    compromissos: itensAgenda(b, { hoje }).filter((i) => i.data === hoje && i.tipo !== "aniversario" && i.tipo !== "casamento"),
    aniversariosHoje: aniversarios.filter((a) => a.dias === 0),
    aniversariosEmBreve: aniversarios.filter((a) => a.dias > 0).slice(0, 4),
    radar: radarDoCasal(b, hoje),
    segunda: d.getDay() === 1,
  };
}

export function textoMarco(m: number): string {
  if (m === 0) return "Hoje é o grande dia!";
  if (m === 1) return "Amanhã é o casamento!";
  return `Faltam ${m} dias para o casamento!`;
}

const nomeP = (b: Banco, p: string) => (p === "p1" ? b.config.nomeP1 : p === "p2" ? b.config.nomeP2 : "");

/** Versão em texto (reserva quando a imagem falha ou está desligada). */
export function textoBomDia(b: Banco, bd: BomDia): string {
  const corpo: string[] = [`_${bd.dataExtenso}_`];
  if (bd.marco !== null) corpo.push("", `*${textoMarco(bd.marco)}*`);
  else if (bd.diasCasamento !== null && bd.diasCasamento > 0) corpo.push(`Faltam ${bd.diasCasamento} dias para o casamento`);
  if (bd.aniversariosHoje.length) {
    corpo.push("", "*Aniversário hoje*", ...bd.aniversariosHoje.map((a) => `- ${a.aniversario.nome}${a.idade ? ` · ${textoIdade(a.idade)}` : ""}`));
  }
  corpo.push("", "*Hoje*");
  if (bd.compromissos.length) {
    corpo.push(...bd.compromissos.map((i) => `- ${i.hora ? `*${i.hora}* — ` : ""}${i.titulo}${[i.evento?.local, nomeP(b, i.pessoa)].filter(Boolean).length ? ` _(${[i.evento?.local, nomeP(b, i.pessoa)].filter(Boolean).join(" · ")})_` : ""}`));
  } else corpo.push("Nenhum compromisso. Dia livre!");
  if (bd.radar.length) corpo.push("", "*Radar*", ...bd.radar.map((a) => `- ${a.texto}`));
  if (bd.aniversariosEmBreve.length) {
    corpo.push("", "*Aniversários chegando*", ...bd.aniversariosEmBreve.map((a) => `- ${a.aniversario.nome} · ${rotuloDia(a.data, bd.hoje)}${a.idade ? ` · ${textoIdade(a.idade)}` : ""}`));
  }
  return cartao(`*${bd.saudacao}*`, corpo, "Mande agenda semana para ver os próximos dias");
}
