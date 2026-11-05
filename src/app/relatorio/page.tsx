"use client";

import { useState } from "react";
import { useDados } from "@/lib/store";
import { comparativoCategorias, contasDoMes, planoCasamento, resumoMes, totaisContas, variacao } from "@/lib/calc";
import { dataBR, dinheiro, hojeISO, mesAtual, mesesAte, nomeMes, pct, somarMeses } from "@/lib/format";
import { Botao, Card, cx, Input, Titulo, usePessoas } from "@/components/ui";
import { BarrasMensais, Ranking } from "@/components/graficos";

export default function Relatorio() {
  const { banco } = useDados();
  const { nome } = usePessoas();
  const [de, setDe] = useState(mesAtual());
  const [ate, setAte] = useState(mesAtual());
  const [comLista, setComLista] = useState(true);

  const qtd = Math.max(1, Math.min(36, mesesAte(de, ate)));
  const meses = Array.from({ length: qtd }, (_, i) => somarMeses(de, i));
  const resumos = meses.map((m) => resumoMes(banco, m));
  const tot = resumos.reduce(
    (s, r) => ({ receitas: s.receitas + r.receitas, despesas: s.despesas + r.despesas, guardado: s.guardado + r.guardado, casa: s.casa + r.casa }),
    { receitas: 0, despesas: 0, guardado: 0, casa: 0 },
  );
  const sobra = tot.receitas - tot.despesas - tot.guardado;

  const porCat = new Map<string, { nome: string; total: number }>();
  for (const r of resumos)
    for (const c of r.porCategoria) {
      const k = c.categoria.id;
      porCat.set(k, { nome: `${c.categoria.emoji} ${c.categoria.nome}`, total: (porCat.get(k)?.total ?? 0) + c.total });
    }
  const categorias = [...porCat.entries()].sort((a, b) => b[1].total - a[1].total);

  const unico = qtd === 1;
  const comparativo = unico ? comparativoCategorias(banco, de, somarMeses(de, -1)) : [];
  const contas = unico ? contasDoMes(banco, de, hojeISO()) : [];
  const tc = totaisContas(contas);
  const plano = planoCasamento(banco, mesAtual());
  const cats = new Map(banco.categorias.map((c) => [c.id, c]));
  const lancs = banco.lancamentos.filter((l) => l.data.slice(0, 7) >= de && l.data.slice(0, 7) <= ate).sort((a, b) => a.data.localeCompare(b.data));
  const periodo = unico ? nomeMes(de) : `${nomeMes(de)} a ${nomeMes(ate)}`;

  return (
    <div className="space-y-4">
      <Titulo
        titulo="Relatório financeiro"
        sub="Escolha o período e imprima ou salve em PDF"
        acoes={
          <Botao onClick={() => window.print()} className="no-print">
            🖨️ Imprimir / PDF
          </Botao>
        }
      />

      <Card className="no-print">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted">
            De
            <Input type="month" value={de} onChange={(e) => e.target.value && setDe(e.target.value)} className="mt-1 w-44" />
          </label>
          <label className="text-xs text-muted">
            Até
            <Input type="month" value={ate} min={de} onChange={(e) => e.target.value && setAte(e.target.value)} className="mt-1 w-44" />
          </label>
          <div className="flex flex-wrap gap-1.5">
            <Botao variante="secundario" pequeno onClick={() => { setDe(mesAtual()); setAte(mesAtual()); }}>Este mês</Botao>
            <Botao variante="secundario" pequeno onClick={() => { setDe(somarMeses(mesAtual(), -1)); setAte(somarMeses(mesAtual(), -1)); }}>Mês passado</Botao>
            <Botao variante="secundario" pequeno onClick={() => { setDe(somarMeses(mesAtual(), -5)); setAte(mesAtual()); }}>Últimos 6 meses</Botao>
            <Botao variante="secundario" pequeno onClick={() => { const primeiro = banco.lancamentos.map((l) => l.data.slice(0, 7)).sort()[0] ?? mesAtual(); setDe(primeiro); setAte(mesAtual()); }}>
              Desde o início
            </Botao>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={comLista} onChange={(e) => setComLista(e.target.checked)} className="h-4 w-4" />
            Incluir lista de lançamentos
          </label>
        </div>
      </Card>

      {/* Cabeçalho impresso */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Relatório financeiro · {banco.config.nomeP1} & {banco.config.nomeP2}</div>
            <div className="text-xl font-semibold">{periodo}</div>
          </div>
          <div className="text-xs text-muted">Gerado em {dataBR(hojeISO())}</div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ["Receitas", tot.receitas, "text-receita"],
            ["Gastos", tot.despesas, "text-despesa"],
            ["Guardado", tot.guardado, "text-guardado"],
            ["Sobra", sobra, sobra < 0 ? "text-danger" : ""],
            ["Custo da casa", tot.casa, ""],
          ].map(([n, v, c]) => (
            <div key={n as string}>
              <div className="text-xs text-muted">{n}</div>
              <div className={cx("num text-lg font-semibold", c as string)}>{dinheiro(v as number)}</div>
            </div>
          ))}
        </div>
        {tot.receitas > 0 && (
          <p className="mt-3 text-sm text-muted">
            Vocês gastaram <strong className="text-ink">{pct(tot.despesas / tot.receitas)}</strong> do que receberam e guardaram{" "}
            <strong className="text-ink">{pct(tot.guardado / tot.receitas)}</strong>.
          </p>
        )}
      </div>

      {!unico && (
        <Card titulo="Evolução no período">
          <BarrasMensais
            rotulos={meses.map((m) => nomeMes(m, true))}
            series={[
              { nome: "Receitas", cor: "var(--receita)", valores: resumos.map((r) => r.receitas) },
              { nome: "Gastos", cor: "var(--despesa)", valores: resumos.map((r) => r.despesas) },
              { nome: "Guardado", cor: "var(--guardado)", valores: resumos.map((r) => r.guardado) },
            ]}
          />
        </Card>
      )}

      <Card titulo="Mês a mês">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="py-2 font-medium">Mês</th>
                <th className="py-2 text-right font-medium">Receitas</th>
                <th className="py-2 text-right font-medium">Gastos</th>
                <th className="py-2 text-right font-medium">Guardado</th>
                <th className="py-2 text-right font-medium">Sobra</th>
                <th className="py-2 text-right font-medium">Casa</th>
                <th className="py-2 text-right font-medium">Var. casa</th>
              </tr>
            </thead>
            <tbody className="num">
              {resumos.map((r) => {
                const v = variacao(r.casa, resumoMes(banco, somarMeses(r.mes, -1)).casa);
                return (
                  <tr key={r.mes} className="border-t border-line">
                    <td className="py-2">{nomeMes(r.mes, true)}</td>
                    <td className="py-2 text-right">{dinheiro(r.receitas)}</td>
                    <td className="py-2 text-right">{dinheiro(r.despesas)}</td>
                    <td className="py-2 text-right">{dinheiro(r.guardado)}</td>
                    <td className={cx("py-2 text-right", r.sobra < 0 && "text-danger")}>{dinheiro(r.sobra)}</td>
                    <td className="py-2 text-right">{dinheiro(r.casa)}</td>
                    <td className={cx("py-2 text-right", v !== null && (v > 0 ? "text-danger" : "text-ok"))}>{v === null ? "—" : `${v > 0 ? "+" : ""}${pct(v, 1)}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card titulo="Gastos por categoria">
          {categorias.length ? (
            <Ranking total={tot.despesas} itens={categorias.map(([id, c]) => ({ chave: id, rotulo: c.nome, valor: c.total }))} />
          ) : (
            <p className="text-sm text-muted">Sem gastos no período.</p>
          )}
        </Card>

        {unico ? (
          <Card titulo={`Comparativo com ${nomeMes(somarMeses(de, -1))}`}>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="pb-2 font-medium">Categoria</th>
                  <th className="pb-2 text-right font-medium">Anterior</th>
                  <th className="pb-2 text-right font-medium">Atual</th>
                  <th className="pb-2 text-right font-medium">Diferença</th>
                </tr>
              </thead>
              <tbody className="num">
                {comparativo.map((c) => (
                  <tr key={c.categoria.id} className="border-t border-line">
                    <td className="py-1.5">
                      {c.categoria.emoji} {c.categoria.nome}
                    </td>
                    <td className="py-1.5 text-right text-muted">{dinheiro(c.anterior)}</td>
                    <td className="py-1.5 text-right">{dinheiro(c.atual)}</td>
                    <td className={cx("py-1.5 text-right", c.diferenca > 0 ? "text-danger" : c.diferenca < 0 ? "text-ok" : "")}>
                      {c.diferenca > 0 ? "+" : ""}
                      {dinheiro(c.diferenca)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!comparativo.length && <p className="text-sm text-muted">Sem dados para comparar.</p>}
          </Card>
        ) : (
          <Card titulo="Por pessoa no período">
            <PorPessoa resumos={resumos} nome={nome} />
          </Card>
        )}
      </div>

      {unico && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card titulo={`Contas do dia ${banco.config.diaPadraoContas}`}>
            {contas.length ? (
              <>
                <ul className="space-y-1 text-sm">
                  {contas.map((c) => (
                    <li key={c.conta.id} className="flex justify-between gap-2">
                      <span>
                        {c.pago ? "☑" : "☐"} {c.conta.nome}
                      </span>
                      <span className="num">{dinheiro(c.valor)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 border-t border-line pt-2 text-sm">
                  Pago {dinheiro(tc.pago)} de {dinheiro(tc.total)} · falta <strong>{dinheiro(tc.falta)}</strong>
                </p>
              </>
            ) : (
              <p className="text-sm text-muted">Nenhuma conta fixa cadastrada.</p>
            )}
          </Card>
          <Card titulo="Por pessoa">
            <PorPessoa resumos={resumos} nome={nome} />
          </Card>
        </div>
      )}

      <Card titulo="💍 Reserva do casamento (hoje)">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted">Total guardado</div>
            <div className="num font-semibold">{dinheiro(plano.guardado)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Pago com a reserva</div>
            <div className="num font-semibold">{dinheiro(plano.pagoDaReserva)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Disponível</div>
            <div className="num font-semibold">{dinheiro(plano.disponivel)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Falta guardar</div>
            <div className="num font-semibold text-danger">{dinheiro(plano.faltaGuardar)}</div>
          </div>
        </div>
      </Card>

      {comLista && (
        <Card titulo={`Lançamentos (${lancs.length})`} className="print-break">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-1.5 font-medium">Data</th>
                  <th className="py-1.5 font-medium">Descrição</th>
                  <th className="py-1.5 font-medium">Categoria</th>
                  <th className="py-1.5 font-medium">Pessoa</th>
                  <th className="py-1.5 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody className="num">
                {lancs.map((l) => (
                  <tr key={l.id} className="border-t border-line">
                    <td className="py-1.5">{dataBR(l.data)}</td>
                    <td className="py-1.5">{l.descricao}</td>
                    <td className="py-1.5">{cats.get(l.categoriaId)?.nome ?? "—"}</td>
                    <td className="py-1.5">{nome(l.pessoa)}</td>
                    <td className={cx("py-1.5 text-right", l.tipo === "receita" ? "text-receita" : l.tipo === "guardado" ? "text-guardado" : "")}>
                      {l.tipo === "despesa" ? "−" : "+"}
                      {dinheiro(l.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function PorPessoa({ resumos, nome }: { resumos: ReturnType<typeof resumoMes>[]; nome: (p: "p1" | "p2" | "casal") => string }) {
  const soma = (p: "p1" | "p2" | "casal", k: "receitas" | "despesas" | "guardado") => resumos.reduce((s, r) => s + r.porPessoa[p][k], 0);
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs text-muted">
        <tr>
          <th className="pb-2 font-medium"></th>
          <th className="pb-2 text-right font-medium">Receitas</th>
          <th className="pb-2 text-right font-medium">Gastos</th>
          <th className="pb-2 text-right font-medium">Guardado</th>
        </tr>
      </thead>
      <tbody className="num">
        {(["p1", "p2", "casal"] as const).map((p) => (
          <tr key={p} className="border-t border-line">
            <td className="py-1.5">{nome(p)}</td>
            <td className="py-1.5 text-right">{dinheiro(soma(p, "receitas"))}</td>
            <td className="py-1.5 text-right">{dinheiro(soma(p, "despesas"))}</td>
            <td className="py-1.5 text-right">{dinheiro(soma(p, "guardado"))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
