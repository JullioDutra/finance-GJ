"use client";

import Link from "next/link";
import { useState } from "react";
import { useDados } from "@/lib/store";
import { contasDoMes, planoCasamento, resumoMes, serieMeses, totaisContas, variacao } from "@/lib/calc";
import { dinheiro, hojeISO, mesAtual, nomeMes, pct, somarMeses } from "@/lib/format";
import { Barra, Botao, Card, SeletorMes, Stat, Titulo, Variacao, Vazio } from "@/components/ui";
import { BarrasMensais, Linha, Ranking } from "@/components/graficos";
import { useLancamentoModal } from "@/components/shell";

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
  const taxaPoupanca = r.receitas > 0 ? r.guardado / r.receitas : 0;
  const rotulos = serie.map((s) => nomeMes(s.mes, true));

  return (
    <div className="space-y-4">
      <Titulo
        titulo="Painel financeiro"
        sub="Receitas, gastos e quanto vocês estão guardando"
        acoes={
          <>
            <SeletorMes mes={mes} setMes={setMes} />
            <Botao variante="secundario" onClick={() => window.print()}>
              🖨️ Imprimir
            </Botao>
          </>
        }
      />

      {/* Alerta do dia 6 */}
      {tc.qtd > 0 && tc.falta > 0 && (
        <Link href="/contas" className="no-print flex items-center justify-between gap-3 rounded-2xl border border-warn/30 bg-warn-soft p-3.5 text-warn">
          <span className="text-sm">
            <strong>Contas do dia {banco.config.diaPadraoContas}:</strong> {tc.qtd - tc.qtdPagas} pendente(s) — falta {dinheiro(tc.falta)}
            {tc.atrasadas > 0 && <> · ⚠️ {tc.atrasadas} atrasada(s)</>}
          </span>
          <span className="text-sm font-medium">Ver checklist →</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat rotulo="Receitas" cor="bg-receita" valor={dinheiro(r.receitas)} detalhe={<Variacao v={variacao(r.receitas, ant.receitas)} />} />
        <Stat rotulo="Gastos" cor="bg-despesa" valor={dinheiro(r.despesas)} detalhe={<Variacao v={variacao(r.despesas, ant.despesas)} inverso />} />
        <Stat
          rotulo="Guardado"
          cor="bg-guardado"
          valor={dinheiro(r.guardado)}
          detalhe={meta > 0 ? `${pct(r.guardado / meta)} da meta de ${dinheiro(meta)}` : `${pct(taxaPoupanca)} da receita`}
        />
        <Stat
          rotulo="Sobra do mês"
          valor={<span className={r.sobra < 0 ? "text-danger" : ""}>{dinheiro(r.sobra)}</span>}
          detalhe={r.sobra < 0 ? "Gastaram mais do que entrou" : "Receitas − gastos − guardado"}
          destaque
        />
      </div>

      {r.qtd === 0 && (
        <Vazio acao={<Botao onClick={() => abrir()}>+ Primeiro lançamento</Botao>}>
          Nenhum lançamento em {nomeMes(mes)}. Lance pelo botão “+” ou mande uma mensagem no WhatsApp.
        </Vazio>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card titulo="Receita x Gasto x Guardado (6 meses)" className="lg:col-span-2">
          <BarrasMensais
            rotulos={rotulos}
            series={[
              { nome: "Receitas", cor: "var(--receita)", valores: serie.map((s) => s.receitas) },
              { nome: "Gastos", cor: "var(--despesa)", valores: serie.map((s) => s.despesas) },
              { nome: "Guardado", cor: "var(--guardado)", valores: serie.map((s) => s.guardado) },
            ]}
          />
        </Card>

        <Card titulo="Para onde vai o dinheiro">
          {r.receitas > 0 ? (
            <div className="space-y-3 text-sm">
              {[
                { nome: "Gastos", v: r.despesas, cor: "bg-despesa" },
                { nome: "Guardado", v: r.guardado, cor: "bg-guardado" },
                { nome: "Sobra", v: Math.max(0, r.sobra), cor: "bg-receita" },
              ].map((x) => (
                <div key={x.nome}>
                  <div className="mb-1 flex justify-between">
                    <span>{x.nome}</span>
                    <span className="num font-medium">
                      {dinheiro(x.v)} <span className="text-xs text-muted">{pct(x.v / r.receitas)}</span>
                    </span>
                  </div>
                  <Barra valor={x.v} total={r.receitas} cor={x.cor} />
                </div>
              ))}
              <p className="pt-1 text-xs text-muted">Percentuais em relação às receitas do mês.</p>
            </div>
          ) : (
            <p className="text-sm text-muted">Lance as receitas do mês para ver a divisão.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card titulo="🏠 Custo da casa mês a mês" className="lg:col-span-2">
          <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
            <span className="num text-2xl font-semibold">{dinheiro(r.casa)}</span>
            <Variacao v={variacao(r.casa, ant.casa)} inverso />
          </div>
          <Linha nome="Custo da casa" rotulos={rotulos} valores={serie.map((s) => s.casa)} />
          <p className="mt-1 text-xs text-muted">Soma das categorias marcadas como “casa” (aluguel, contas, mercado…). Ajuste em Ajustes → Categorias.</p>
        </Card>

        <Card titulo="Tópicos mais gastos" acao={<Link href="/relatorio" className="no-print text-xs text-brand">Detalhar →</Link>}>
          {r.porCategoria.length ? (
            <Ranking
              total={r.despesas}
              itens={r.porCategoria.slice(0, 6).map((c) => ({ chave: c.categoria.id, rotulo: `${c.categoria.emoji} ${c.categoria.nome}`, valor: c.total }))}
            />
          ) : (
            <p className="text-sm text-muted">Sem gastos neste mês.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card titulo="Quem gastou / recebeu">
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
                  <td className="py-2">{p === "p1" ? banco.config.nomeP1 : p === "p2" ? banco.config.nomeP2 : "Casal"}</td>
                  <td className="py-2 text-right">{dinheiro(r.porPessoa[p].receitas)}</td>
                  <td className="py-2 text-right">{dinheiro(r.porPessoa[p].despesas)}</td>
                  <td className="py-2 text-right">{dinheiro(r.porPessoa[p].guardado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card titulo="💍 Reserva do casamento" acao={<Link href="/casamento" className="no-print text-xs text-brand">Abrir →</Link>}>
          <div className="num text-2xl font-semibold">{dinheiro(plano.disponivel)}</div>
          <p className="text-xs text-muted">disponível agora (guardado {dinheiro(plano.guardado)} − pago com a reserva {dinheiro(plano.pagoDaReserva)})</p>
          {plano.totalRestante > 0 && (
            <>
              <div className="mt-3">
                <Barra valor={Math.max(0, plano.disponivel)} total={plano.totalRestante} cor="bg-guardado" />
              </div>
              <p className="mt-1.5 text-sm">
                Falta pagar aos fornecedores: <strong>{dinheiro(plano.totalRestante)}</strong>
                {plano.faltaGuardar > 0 ? (
                  <>
                    {" "}
                    · falta guardar <strong className="text-danger">{dinheiro(plano.faltaGuardar)}</strong>
                  </>
                ) : (
                  <span className="text-ok"> · reserva cobre tudo 🎉</span>
                )}
              </p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
