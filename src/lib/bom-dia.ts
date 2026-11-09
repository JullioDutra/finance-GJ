// "Bom dia" das 7h no WhatsApp: só a agenda do dia. Compromissos, aniversariantes e tarefas a fazer.
// Nada financeiro (contas e pagamentos de fornecedores ficam de fora).
// Função pura: o texto e o cartão em imagem usam os mesmos dados.

import type { Banco } from "./types";
import { itensAgenda, rotuloDia, type ItemAgenda } from "./agenda";
import { diasEntre } from "./format";
import { proximosAniversarios, textoIdade, type ProximoAniversario } from "./aniversarios";
import { checklistTarefas, type ItemChecklist } from "./tarefas";
import { cartao } from "./whatsapp-modelos";

export interface BomDia {
  hoje: string;
  dataExtenso: string;
  diasCasamento: number | null;
  /** marco especial da contagem regressiva (ex.: 100), quando hoje é um */
  marco: number | null;
  compromissos: ItemAgenda[];
  aniversariosHoje: ProximoAniversario[];
  aniversariosEmBreve: ProximoAniversario[];
  /** tarefas atrasadas, de hoje e dos próximos 7 dias (com o número do checklist, para "feito 3") */
  tarefas: ItemChecklist[];
  tarefasPendentes: number;
  segunda: boolean;
}

const MARCOS = new Set([365, 300, 250, 200, 150, 100, 90, 60, 50, 45, 30, 21, 15, 14, 10, 7, 5, 3, 2, 1, 0]);
const SEMANA_EXT = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const MESES_EXT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const MAX_TAREFAS_BOM_DIA = 6;

export function montarBomDia(b: Banco, hoje: string): BomDia {
  const d = new Date(hoje + "T12:00:00");
  const diasCasamento = b.config.dataCasamento ? diasEntre(hoje, b.config.dataCasamento) : null;
  const aniversarios = proximosAniversarios(b, hoje, 7);
  const ck = checklistTarefas(b, hoje);
  const tarefas = ck.itens
    .filter((i) => i.tarefa.prazo && diasEntre(hoje, i.tarefa.prazo) <= 7)
    .sort((x, y) => x.tarefa.prazo.localeCompare(y.tarefa.prazo) || x.n - y.n);
  return {
    hoje,
    dataExtenso: `${SEMANA_EXT[d.getDay()]}, ${d.getDate()} de ${MESES_EXT[d.getMonth()]}`,
    diasCasamento,
    marco: diasCasamento !== null && MARCOS.has(diasCasamento) ? diasCasamento : null,
    // só compromissos de verdade: contas, fornecedores e prazos de tarefas ficam fora daqui
    compromissos: itensAgenda(b, { hoje }).filter((i) => i.data === hoje && i.tipo === "evento"),
    aniversariosHoje: aniversarios.filter((a) => a.dias === 0),
    aniversariosEmBreve: aniversarios.filter((a) => a.dias > 0).slice(0, 4),
    tarefas,
    tarefasPendentes: ck.itens.length,
    segunda: d.getDay() === 1,
  };
}

export function textoMarco(m: number): string {
  if (m === 0) return "Hoje é o grande dia!";
  if (m === 1) return "Amanhã é o casamento!";
  return `Faltam ${m} dias para o casamento!`;
}

/** "atrasada", "hoje", "até sex, 13/11" */
export function prazoTarefa(it: ItemChecklist, hoje: string): string {
  const p = it.tarefa.prazo;
  if (!p) return "";
  if (p < hoje) return "atrasada";
  if (p === hoje) return "hoje";
  return `até ${rotuloDia(p, hoje)}`;
}

const nomeP = (b: Banco, p: string) => (p === "p1" ? b.config.nomeP1 : p === "p2" ? b.config.nomeP2 : "");

/** Versão em texto (reserva quando a imagem falha ou está desligada). */
export function textoBomDia(b: Banco, bd: BomDia): string {
  const nomes = [b.config.nomeP1, b.config.nomeP2].filter(Boolean).join(" e ");
  const corpo: string[] = [`_${bd.dataExtenso}_`];
  if (bd.marco !== null) corpo.push("", `*${textoMarco(bd.marco)}*`);
  else if (bd.diasCasamento !== null && bd.diasCasamento > 0) corpo.push(`Faltam ${bd.diasCasamento} dias para o casamento`);
  if (bd.aniversariosHoje.length) {
    corpo.push("", "*Aniversário hoje*", ...bd.aniversariosHoje.map((a) => `- ${a.aniversario.nome}${a.idade ? ` · ${textoIdade(a.idade)}` : ""}`));
  }
  corpo.push("", "*Compromissos de hoje*");
  if (bd.compromissos.length) {
    corpo.push(
      ...bd.compromissos.map((i) => {
        const extra = [i.evento?.local, nomeP(b, i.pessoa)].filter(Boolean).join(" · ");
        return `- ${i.hora ? `*${i.hora}* — ` : ""}${i.titulo}${extra ? ` _(${extra})_` : ""}`;
      }),
    );
  } else corpo.push("Nenhum compromisso. Dia livre!");
  if (bd.tarefas.length) {
    corpo.push("", "*Tarefas a fazer*", ...bd.tarefas.slice(0, MAX_TAREFAS_BOM_DIA).map((t) => `${t.n}. ☐ ${t.tarefa.titulo} _(${prazoTarefa(t, bd.hoje)})_`));
  }
  if (bd.aniversariosEmBreve.length) {
    corpo.push("", "*Aniversários chegando*", ...bd.aniversariosEmBreve.map((a) => `- ${a.aniversario.nome} · ${rotuloDia(a.data, bd.hoje)}${a.idade ? ` · ${textoIdade(a.idade)}` : ""}`));
  }
  return cartao(`*${bd.segunda ? "Bom dia e boa semana" : "Bom dia"}${nomes ? `, ${nomes}` : ""}*`, corpo, bd.tarefas.length ? "Fez uma tarefa? Mande feito e o número" : "Mande agenda semana para ver os próximos dias");
}
