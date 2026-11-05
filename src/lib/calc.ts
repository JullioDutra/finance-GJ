import type { Banco, Categoria, ContaFixa, Fornecedor, Lancamento, PagamentoConta, PessoaId } from "./types";
import { mesAtual, mesDe, mesesAte, ultimosMeses } from "./format";

// =============================================================
// FINANÇAS
// =============================================================

export interface ResumoMes {
  mes: string;
  receitas: number;
  despesas: number;
  guardado: number;
  sobra: number; // receitas - despesas - guardado
  casa: number; // despesas de categorias marcadas como "casa"
  porCategoria: { categoria: Categoria; total: number }[];
  porPessoa: Record<PessoaId, { receitas: number; despesas: number; guardado: number }>;
  qtd: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function lancamentosDoMes(b: Banco, mes: string): Lancamento[] {
  return b.lancamentos.filter((l) => mesDe(l.data) === mes);
}

export function resumoMes(b: Banco, mes: string): ResumoMes {
  const ls = lancamentosDoMes(b, mes);
  const catMap = new Map(b.categorias.map((c) => [c.id, c]));
  const porCat = new Map<string, number>();
  const porPessoa: ResumoMes["porPessoa"] = {
    p1: { receitas: 0, despesas: 0, guardado: 0 },
    p2: { receitas: 0, despesas: 0, guardado: 0 },
    casal: { receitas: 0, despesas: 0, guardado: 0 },
  };
  let receitas = 0, despesas = 0, guardado = 0, casa = 0;
  for (const l of ls) {
    const pp = porPessoa[l.pessoa] ?? porPessoa.casal;
    if (l.tipo === "receita") { receitas += l.valor; pp.receitas += l.valor; }
    else if (l.tipo === "guardado") { guardado += l.valor; pp.guardado += l.valor; }
    else {
      despesas += l.valor;
      pp.despesas += l.valor;
      porCat.set(l.categoriaId, (porCat.get(l.categoriaId) ?? 0) + l.valor);
      if (catMap.get(l.categoriaId)?.casa) casa += l.valor;
    }
  }
  const outros: Categoria = { id: "?", nome: "Sem categoria", tipo: "despesa", emoji: "❔", casa: false, palavras: "" };
  const porCategoria = [...porCat.entries()]
    .map(([id, total]) => ({ categoria: catMap.get(id) ?? outros, total: r2(total) }))
    .sort((a, b) => b.total - a.total);
  return {
    mes,
    receitas: r2(receitas),
    despesas: r2(despesas),
    guardado: r2(guardado),
    sobra: r2(receitas - despesas - guardado),
    casa: r2(casa),
    porCategoria,
    porPessoa,
    qtd: ls.length,
  };
}

export function serieMeses(b: Banco, fim: string, qtd: number): ResumoMes[] {
  return ultimosMeses(fim, qtd).map((m) => resumoMes(b, m));
}

/** Variação percentual entre dois valores (null se não há base). */
export function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return (atual - anterior) / anterior;
}

/** Comparativo por categoria de despesa: mês atual x anterior. */
export function comparativoCategorias(b: Banco, mes: string, mesAnterior: string) {
  const a = resumoMes(b, mes);
  const p = resumoMes(b, mesAnterior);
  const ids = new Set([...a.porCategoria, ...p.porCategoria].map((x) => x.categoria.id));
  return [...ids]
    .map((id) => {
      const atual = a.porCategoria.find((x) => x.categoria.id === id);
      const ant = p.porCategoria.find((x) => x.categoria.id === id);
      const categoria = (atual ?? ant)!.categoria;
      return {
        categoria,
        atual: atual?.total ?? 0,
        anterior: ant?.total ?? 0,
        diferenca: r2((atual?.total ?? 0) - (ant?.total ?? 0)),
      };
    })
    .sort((x, y) => y.atual - x.atual);
}

// ---------- Contas fixas (dia 6) ----------

export interface ContaDoMes {
  conta: ContaFixa;
  pagamento?: PagamentoConta;
  pago: boolean;
  valor: number; // pago (se pago) ou previsto
  vencimento: string; // YYYY-MM-DD
  atrasada: boolean;
}

export function contasDoMes(b: Banco, mes: string, hoje: string): ContaDoMes[] {
  return b.contas
    .filter((c) => c.ativa)
    .map((conta) => {
      const pagamento = b.pagamentosContas.find((p) => p.contaId === conta.id && p.mes === mes);
      const pago = !!pagamento?.pago;
      const [y, m] = mes.split("-").map(Number);
      const ultimoDia = new Date(y, m, 0).getDate();
      const dia = Math.min(Math.max(1, conta.dia || 6), ultimoDia);
      const vencimento = `${mes}-${String(dia).padStart(2, "0")}`;
      return {
        conta,
        pagamento,
        pago,
        valor: pago ? pagamento!.valor : conta.valor,
        vencimento,
        atrasada: !pago && vencimento < hoje,
      };
    })
    .sort((a, b) => Number(a.pago) - Number(b.pago) || a.vencimento.localeCompare(b.vencimento) || a.conta.nome.localeCompare(b.conta.nome));
}

export function totaisContas(lista: ContaDoMes[]) {
  const total = lista.reduce((s, c) => s + c.valor, 0);
  const pago = lista.filter((c) => c.pago).reduce((s, c) => s + c.valor, 0);
  return {
    total: r2(total),
    pago: r2(pago),
    falta: r2(total - pago),
    qtd: lista.length,
    qtdPagas: lista.filter((c) => c.pago).length,
    atrasadas: lista.filter((c) => c.atrasada).length,
  };
}

// =============================================================
// CASAMENTO
// =============================================================

/** Total já guardado para o casamento (reserva inicial + todos os lançamentos "guardado"). */
export function totalGuardado(b: Banco): number {
  return r2(b.config.reservaInicial + b.lancamentos.filter((l) => l.tipo === "guardado").reduce((s, l) => s + l.valor, 0));
}

export interface FornecedorCalc {
  fornecedor: Fornecedor;
  pago: number;
  restante: number;
  quitado: boolean;
  situacao: "quitado" | "da_para_pagar" | "falta";
  falta: number; // quanto falta na reserva para conseguir quitar (se situacao = falta)
  saldoAntes: number; // saldo disponível no momento da alocação
}

export function pagoFornecedor(b: Banco, id: string): number {
  return r2(b.pagamentosFornecedores.filter((p) => p.fornecedorId === id).reduce((s, p) => s + p.valor, 0));
}

/** Ordem de pagamento: vencimento mais próximo primeiro, depois prioridade. */
function ordemFornecedor(a: Fornecedor, b: Fornecedor) {
  const va = a.vencimento || "9999-12-31";
  const vb = b.vencimento || "9999-12-31";
  return va.localeCompare(vb) || a.prioridade - b.prioridade || a.nome.localeCompare(b.nome);
}

export function planoCasamento(b: Banco, hoje = mesAtual()) {
  const guardado = totalGuardado(b);
  const lista = b.fornecedores.map((f) => {
    const pago = pagoFornecedor(b, f.id);
    return { f, pago, restante: r2(Math.max(0, f.valorTotal - pago)) };
  });
  const totalContratado = r2(lista.reduce((s, x) => s + x.f.valorTotal, 0));
  const totalPago = r2(lista.reduce((s, x) => s + x.pago, 0));
  const totalRestante = r2(lista.reduce((s, x) => s + x.restante, 0));
  const pagoDaReserva = r2(b.pagamentosFornecedores.filter((p) => p.daReserva !== false).reduce((s, p) => s + p.valor, 0));
  const disponivel = r2(guardado - pagoDaReserva); // o que ainda está na reserva

  // Alocação: percorre na ordem de vencimento; se o que falta do fornecedor
  // cabe no saldo, ele "já dá para pagar" e o saldo é reservado para ele.
  let saldo = Math.max(0, disponivel);
  const calc: FornecedorCalc[] = [...lista]
    .sort((a, b2) => ordemFornecedor(a.f, b2.f))
    .map(({ f, pago, restante }) => {
      const saldoAntes = r2(saldo);
      if (restante <= 0) return { fornecedor: f, pago, restante, quitado: true, situacao: "quitado", falta: 0, saldoAntes };
      if (restante <= saldo + 0.001) {
        saldo -= restante;
        return { fornecedor: f, pago, restante, quitado: false, situacao: "da_para_pagar", falta: 0, saldoAntes };
      }
      return { fornecedor: f, pago, restante, quitado: false, situacao: "falta", falta: r2(restante - saldo), saldoAntes };
    });

  const daParaPagar = calc.filter((c) => c.situacao === "da_para_pagar");
  const faltam = calc.filter((c) => c.situacao === "falta");
  const orcamento = b.config.orcamentoCasamento > 0 ? b.config.orcamentoCasamento : totalContratado;
  const faltaGuardar = r2(Math.max(0, totalRestante - Math.max(0, disponivel)));

  // Projeção até o casamento
  const mesCasamento = b.config.dataCasamento ? b.config.dataCasamento.slice(0, 7) : "";
  const mesesRestantes = mesCasamento ? Math.max(0, mesesAte(hoje, mesCasamento)) : 0;
  const ult3 = ultimosMeses(hoje, 4).slice(0, 3); // 3 meses anteriores ao atual
  const mediaGuardada = r2(
    ult3.reduce((s, m) => s + b.lancamentos.filter((l) => l.tipo === "guardado" && mesDe(l.data) === m).reduce((x, l) => x + l.valor, 0), 0) / 3,
  );
  const ritmo = b.config.metaMensalGuardar > 0 ? b.config.metaMensalGuardar : mediaGuardada;
  const projecaoNoCasamento = r2(Math.max(0, disponivel) + ritmo * mesesRestantes);
  const precisaPorMes = mesesRestantes > 0 ? r2(faltaGuardar / mesesRestantes) : faltaGuardar;

  return {
    guardado,
    pagoDaReserva,
    disponivel,
    totalContratado,
    totalPago,
    totalRestante,
    orcamento,
    faltaGuardar,
    sobraDepoisDeQuitar: r2(Math.max(0, disponivel) - totalRestante),
    fornecedores: calc,
    daParaPagar,
    faltam,
    valorDaParaPagar: r2(daParaPagar.reduce((s, c) => s + c.restante, 0)),
    mesesRestantes,
    mediaGuardada,
    ritmo,
    projecaoNoCasamento,
    precisaPorMes,
    vaiDar: projecaoNoCasamento >= totalRestante,
  };
}
