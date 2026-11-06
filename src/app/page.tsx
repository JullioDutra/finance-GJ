"use client";

import Link from "next/link";
import { useState } from "react";
import { TriangleAlert, ArrowDownRight, ArrowRight, ArrowUpRight, ChartColumn, Heart, House, PiggyBank, Plus, Printer, Users, Wallet } from "lucide-react";
import { useDados } from "@/lib/store";
import { contasDoMes, planoCasamento, resumoMes, serieMeses, totaisContas, variacao } from "@/lib/calc";
import { dinheiro, hojeISO, mesAtual, nomeMes, pct, somarMeses } from "@/lib/format";
import { Barra, Botao, Card, cx, SeletorMes, Titulo, Variacao, Vazio } from "@/components/ui";
import { BarrasMensais, Linha, Ranking } from "@/components/graficos";
import { useLancamentoModal } from "@/components/shell";
import { RotuloCategoria } from "@/components/icones";

export default function PainelFinancas() {
  const { banco } = useDados();
  const { abrir } = useLancamentoModal();
  const [mes, setMes] = useState(mesAtual());
  const hoje = hojeISO();
  const r = resumoMes(banco, mes);
  const ant = resumoMes(banco, somarMeses(mes, -1));
  const serie = serieMeses(banco, mes, 6);
  const contas = contasDoMes(banco, mes, hoje);
  const tc = totaisContas(contas);
  const plano = planoCasamento(banco, mesAtual());
  const meta = banco.config.metaMensalGuardar;
  const rotulos = serie.map((s) => nomeMes(s.mes, true));

  return (
    <div className="space-y-5">
      <Titulo
        area="Finanças"
        titulo="Painel do mês"
        sub="Receitas, gastos e quanto vocês estão guardando"
        acoes={
          <>
            <SeletorMes mes={mes} setMes={setMes} />
            <Botao variante="secundario" icone={Printer} onClick={() => window.print()}>
              Imprimir
            </Botao>
          </>
        }
      />

      {/* ===== Destaque do mês ===== */}
      <section className="avoid-break grid overflow-hidden rounded-3xl border border-line bg-surface shadow-cartao md:grid-cols-[1.15fr_1fr]">
        <div className="relative bg-hero p-6 text-hero-ink sm:p-7">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full border border-white/10" aria-hidden />
          <div className="pointer-events-none absolute -right-2 top-14 h-24 w-24 rounded-full border border-white/10" aria-hidden />
          <div className="text-xs font-medium uppercase tracking-[0.12em] opacity-75">Sobra de {nomeMes(mes).split(" ")[0].toLowerCase()}</div>
          <div className={cx("display num mt-2 text-[2.6rem] font-medium leading-none sm:text-5xl", r.sobra < 0 && "text-[#ffd2c8]")}>{dinheiro(r.sobra)}</div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed opacity-85">
            {r.receitas > 0 ? (
              <>
                Entraram <strong className="font-semibold">{dinheiro(r.receitas)}</strong>, saíram <strong className="font-semibold">{dinheiro(r.despesas)}</strong> e vocês
                guardaram <strong className="font-semibold">{pct(r.guardado / r.receitas)}</strong> da renda.
              </>
            ) : (
              "Lance as receitas do mês para ver o resumo completo."
            )}
          </p>
          {meta > 0 && (
            <div className="mt-5 max-w-sm">
              <div className="mb-1.5 flex justify-between text-xs opacity-80">
                <span>Meta de guardar</span>
                <span className="num">
                  {dinheiro(r.guardado)} de {dinheiro(meta)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(100, (r.guardado / meta) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>
        <div className="grid divide-y divide-line">
          <MiniIndicador icone={ArrowUpRight} cor="text-receita bg-receita/12" rotulo="Receitas" valor={r.receitas} extra={<Variacao v={variacao(r.receitas, ant.receitas)} />} />
          <MiniIndicador icone={ArrowDownRight} cor="text-despesa bg-despesa/12" rotulo="Gastos" valor={r.despesas} extra={<Variacao v={variacao(r.despesas, ant.despesas)} inverso />} />
          <MiniIndicador
            icone={PiggyBank}
            cor="text-guardado bg-guardado/14"
            rotulo="Guardado"
            valor={r.guardado}
            extra={<span className="text-xs text-muted">{r.receitas > 0 ? `${pct(r.guardado / r.receitas)} da receita` : "—"}</span>}
          />
        </div>
      </section>

      {/* ===== Alerta das contas do dia 6 ===== */}
      {tc.qtd > 0 && tc.falta > 0 && (
        <Link
          href="/contas"
          className="no-print group flex items-center gap-3 rounded-2xl border border-warn/25 bg-warn-soft px-4 py-3.5 text-warn transition hover:border-warn/50"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-warn/12">
            <TriangleAlert className="h-[18px] w-[18px]" />
          </span>
          <span className="flex-1 text-sm">
            <strong>Contas do dia {banco.config.diaPadraoContas}:</strong> {tc.qtd - tc.qtdPagas} pendente(s), faltam <span className="num font-semibold">{dinheiro(tc.falta)}</span>
            {tc.atrasadas > 0 && <> · {tc.atrasadas} atrasada(s)</>}
          </span>
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </Link>
      )}

      {r.qtd === 0 && (
        <Vazio icone={Wallet} acao={<Botao icone={Plus} onClick={() => abrir()}>Primeiro lançamento</Botao>}>
          Nenhum lançamento em {nomeMes(mes)}. Use o botão de novo lançamento para começar.
        </Vazio>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card titulo="Receita, gasto e guardado" icone={ChartColumn} className="lg:col-span-2" acao={<span className="text-xs text-muted">últimos 6 meses</span>}>
          <BarrasMensais
            rotulos={rotulos}
            series={[
              { nome: "Receitas", cor: "var(--receita)", valores: serie.map((s) => s.receitas) },
              { nome: "Gastos", cor: "var(--despesa)", valores: serie.map((s) => s.despesas) },
              { nome: "Guardado", cor: "var(--guardado)", valores: serie.map((s) => s.guardado) },
            ]}
          />
        </Card>

        <Card titulo="Mais gastos do mês" icone={ArrowDownRight} acao={<Link href="/relatorio" className="no-print text-xs font-medium text-brand">Detalhar</Link>}>
          {r.porCategoria.length ? (
            <Ranking total={r.despesas} itens={r.porCategoria.slice(0, 6).map((c) => ({ chave: c.categoria.id, rotulo: <RotuloCategoria categoria={c.categoria} />, valor: c.total }))} />
          ) : (
            <p className="text-sm text-muted">Sem gastos neste mês.</p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card titulo="Custo da casa" icone={House} className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="display num text-3xl font-medium">{dinheiro(r.casa)}</span>
            <Variacao v={variacao(r.casa, ant.casa)} inverso />
          </div>
          <Linha nome="Custo da casa" rotulos={rotulos} valores={serie.map((s) => s.casa)} />
          <p className="mt-2 text-xs text-muted">Aluguel, contas e mercado — as categorias marcadas como “casa” em Ajustes.</p>
        </Card>

        <Card titulo="Reserva do casamento" icone={Heart} acao={<Link href="/casamento" className="no-print text-xs font-medium text-brand">Abrir</Link>}>
          <div className="display num text-3xl font-medium">{dinheiro(plano.disponivel)}</div>
          <p className="mt-1 text-xs text-muted">disponível agora para os fornecedores</p>
          {plano.totalRestante > 0 && (
            <>
              <div className="mt-4">
                <Barra valor={Math.max(0, plano.disponivel)} total={plano.totalRestante} cor="bg-gold" />
              </div>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Falta pagar</dt>
                  <dd className="num font-medium">{dinheiro(plano.totalRestante)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Falta guardar</dt>
                  <dd className={cx("num font-semibold", plano.faltaGuardar > 0 ? "text-danger" : "text-ok")}>{dinheiro(plano.faltaGuardar)}</dd>
                </div>
              </dl>
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card titulo="Para onde vai a renda" icone={Wallet}>
          {r.receitas > 0 ? (
            <div className="space-y-3.5 text-sm">
              {[
                { nome: "Gastos", v: r.despesas, cor: "bg-despesa" },
                { nome: "Guardado", v: r.guardado, cor: "bg-guardado" },
                { nome: "Sobra", v: Math.max(0, r.sobra), cor: "bg-receita" },
              ].map((x) => (
                <div key={x.nome}>
                  <div className="mb-1.5 flex justify-between">
                    <span>{x.nome}</span>
                    <span className="num font-medium">
                      {dinheiro(x.v)} <span className="ml-1 text-xs font-normal text-muted">{pct(x.v / r.receitas)}</span>
                    </span>
                  </div>
                  <Barra valor={x.v} total={r.receitas} cor={x.cor} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Lance as receitas do mês para ver a divisão.</p>
          )}
        </Card>

        <Card titulo="Quem movimentou" icone={Users}>
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
                  <td className="py-2.5 font-medium">{p === "p1" ? banco.config.nomeP1 : p === "p2" ? banco.config.nomeP2 : "Casal"}</td>
                  <td className="py-2.5 text-right">{dinheiro(r.porPessoa[p].receitas)}</td>
                  <td className="py-2.5 text-right">{dinheiro(r.porPessoa[p].despesas)}</td>
                  <td className="py-2.5 text-right">{dinheiro(r.porPessoa[p].guardado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

function MiniIndicador({ icone: Icone, cor, rotulo, valor, extra }: { icone: typeof Wallet; cor: string; rotulo: string; valor: number; extra: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3.5 px-5 py-4 sm:px-6">
      <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-xl", cor)}>
        <Icone className="h-5 w-5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-muted">{rotulo}</div>
        <div className="num text-lg font-semibold tracking-tight">{dinheiro(valor)}</div>
      </div>
      <div className="hidden text-right sm:block">{extra}</div>
    </div>
  );
}
