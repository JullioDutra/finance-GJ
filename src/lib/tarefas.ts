// Checklist das tarefas do casamento: mesma ordem e numeração no texto, no cartão em imagem
// e no comando "feito 3" do WhatsApp.

import type { Banco, Tarefa } from "./types";
import { diasEntre } from "./format";

export type SituacaoTarefa = "atrasada" | "logo" | "normal";

export interface ItemChecklist {
  n: number; // número mostrado (para "feito 3")
  tarefa: Tarefa;
  situacao: SituacaoTarefa;
}

export interface Checklist {
  grupos: { grupo: string; itens: ItemChecklist[] }[];
  /** pendentes na ordem da numeração */
  itens: ItemChecklist[];
  feitas: number;
  total: number;
}

export function situacaoTarefa(t: Tarefa, hoje: string): SituacaoTarefa {
  if (!t.prazo || t.feita) return "normal";
  const d = diasEntre(hoje, t.prazo);
  return d < 0 ? "atrasada" : d <= 7 ? "logo" : "normal";
}

/** Pendentes agrupadas (grupo com o prazo mais próximo primeiro) e numeradas em sequência. */
export function checklistTarefas(b: Banco, hoje: string): Checklist {
  const pend = b.tarefas.filter((t) => !t.feita);
  const chave = (t: Tarefa) => t.prazo || "9999-99-99";
  const porGrupo = new Map<string, Tarefa[]>();
  for (const t of pend) {
    const g = t.grupo || "Outras";
    porGrupo.set(g, [...(porGrupo.get(g) ?? []), t]);
  }
  const grupos = [...porGrupo.entries()]
    .map(([grupo, ts]) => ({ grupo, ts: ts.sort((x, y) => chave(x).localeCompare(chave(y)) || x.titulo.localeCompare(y.titulo)) }))
    .sort((x, y) => chave(x.ts[0]).localeCompare(chave(y.ts[0])) || x.grupo.localeCompare(y.grupo));
  let n = 0;
  const saida = grupos.map(({ grupo, ts }) => ({ grupo, itens: ts.map((tarefa) => ({ n: ++n, tarefa, situacao: situacaoTarefa(tarefa, hoje) })) }));
  return { grupos: saida, itens: saida.flatMap((g) => g.itens), feitas: b.tarefas.length - pend.length, total: b.tarefas.length };
}
