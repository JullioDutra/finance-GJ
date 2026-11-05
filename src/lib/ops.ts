import type { Banco, Colecao, ContaFixa, Lancamento, PagamentoConta } from "./types";
import { hojeISO, novoId } from "./format";

/** Operação de escrita. Tudo que muda dados passa por aqui (app, WhatsApp, importação). */
export type Op =
  | { tipo: "upsert"; colecao: Colecao; id: string; dados: unknown }
  | { tipo: "delete"; colecao: Colecao; id: string };

/** Aplica operações num banco em memória (imutável). */
export function aplicarOps(b: Banco, ops: Op[]): Banco {
  const novo: Banco = { ...b };
  for (const op of ops) {
    if (op.colecao === "config") {
      if (op.tipo === "upsert") novo.config = { ...novo.config, ...(op.dados as object), id: "config" };
      continue;
    }
    const col = op.colecao as Exclude<Colecao, "config">;
    const lista = [...(novo[col] as { id: string }[])];
    const idx = lista.findIndex((x) => x.id === op.id);
    if (op.tipo === "delete") {
      if (idx >= 0) lista.splice(idx, 1);
    } else {
      const dados = { ...(op.dados as object), id: op.id };
      if (idx >= 0) lista[idx] = dados;
      else lista.push(dados);
    }
    (novo as unknown as Record<string, unknown>)[col] = lista;
  }
  return novo;
}

// ---------- ações compostas ----------

/** Marca uma conta fixa como paga no mês: cria o pagamento e o lançamento de despesa. */
export function opsPagarConta(conta: ContaFixa, mes: string, valor?: number, data?: string): Op[] {
  const lancamentoId = `lc-${conta.id}-${mes}`;
  const v = valor ?? conta.valor;
  const dia = data ?? hojeISO();
  const pagamento: PagamentoConta = {
    id: `${conta.id}_${mes}`,
    contaId: conta.id,
    mes,
    pago: true,
    valor: v,
    pagoEm: dia,
    lancamentoId,
  };
  const lanc: Lancamento = {
    id: lancamentoId,
    data: dia,
    tipo: "despesa",
    valor: v,
    categoriaId: conta.categoriaId,
    descricao: `${conta.nome} (conta do mês ${mes.slice(5)}/${mes.slice(0, 4)})`,
    pessoa: conta.pessoa,
    origem: "conta_fixa",
    contaId: conta.id,
    mes,
    criadoEm: new Date().toISOString(),
  };
  return [
    { tipo: "upsert", colecao: "pagamentosContas", id: pagamento.id, dados: pagamento },
    { tipo: "upsert", colecao: "lancamentos", id: lanc.id, dados: lanc },
  ];
}

/** Desfaz o pagamento de uma conta fixa no mês (remove o lançamento gerado). */
export function opsDesfazerConta(b: Banco, contaId: string, mes: string): Op[] {
  const id = `${contaId}_${mes}`;
  const pg = b.pagamentosContas.find((p) => p.id === id);
  const ops: Op[] = [{ tipo: "delete", colecao: "pagamentosContas", id }];
  const lid = pg?.lancamentoId ?? `lc-${contaId}-${mes}`;
  if (b.lancamentos.some((l) => l.id === lid)) ops.push({ tipo: "delete", colecao: "lancamentos", id: lid });
  return ops;
}

export function opNovoLancamento(l: Omit<Lancamento, "id" | "criadoEm"> & { id?: string }): Op {
  const id = l.id ?? novoId();
  return { tipo: "upsert", colecao: "lancamentos", id, dados: { ...l, id, criadoEm: new Date().toISOString() } };
}
