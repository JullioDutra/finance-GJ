"use client";

import { useDados } from "@/lib/store";
import { planoCasamento } from "@/lib/calc";
import { dataBR, diasEntre, dinheiro, hojeISO, mesAtual } from "@/lib/format";
import { TIPOS_EVENTO } from "@/lib/defaults";
import { Botao, Card, cx, Titulo, usePessoas } from "@/components/ui";
import { BarraEmpilhada } from "@/components/graficos";

export default function RelatorioCasamento() {
  const { banco } = useDados();
  const { nome } = usePessoas();
  const hoje = hojeISO();
  const p = planoCasamento(banco, mesAtual());
  const pendentes = banco.tarefas.filter((t) => !t.feita).sort((a, b) => (a.prazo || "9999").localeCompare(b.prazo || "9999"));
  const eventos = banco.eventos.filter((e) => e.data >= hoje).sort((a, b) => a.data.localeCompare(b.data));
  const data = banco.config.dataCasamento;

  return (
    <div className="space-y-4">
      <Titulo
        titulo="Relatório do casamento"
        sub="Fornecedores, pagamentos, tarefas e agenda — pronto para imprimir"
        acoes={<Botao onClick={() => window.print()}>🖨️ Imprimir / PDF</Botao>}
      />

      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">
              Casamento {banco.config.nomeP1} & {banco.config.nomeP2}
            </div>
            <div className="text-xl font-semibold">{data ? `${dataBR(data)} · faltam ${diasEntre(hoje, data)} dias` : "Data a definir"}</div>
          </div>
          <div className="text-xs text-muted">Gerado em {dataBR(hoje)}</div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Contratado", p.totalContratado],
            ["Já pago", p.totalPago],
            ["Falta pagar", p.totalRestante],
            ["Guardado (total)", p.guardado],
            ["Reserva disponível", p.disponivel],
            ["Falta guardar", p.faltaGuardar],
          ].map(([n, v]) => (
            <div key={n as string}>
              <div className="text-xs text-muted">{n}</div>
              <div className="num font-semibold">{dinheiro(v as number)}</div>
            </div>
          ))}
        </div>
        {p.totalContratado > 0 && (
          <div className="mt-4">
            <BarraEmpilhada
              partes={[
                { nome: "Já pago", valor: p.totalPago, cor: "var(--ok)" },
                { nome: "Dá p/ pagar com a reserva", valor: p.valorDaParaPagar, cor: "var(--guardado)" },
                { nome: "Ainda falta dinheiro", valor: p.totalRestante - p.valorDaParaPagar, cor: "var(--despesa)", textura: true },
              ]}
            />
          </div>
        )}
        {data && p.totalRestante > 0 && (
          <p className="mt-3 text-sm">
            Ritmo de {dinheiro(p.ritmo)}/mês → terão {dinheiro(p.projecaoNoCasamento)} no casamento.{" "}
            {p.vaiDar ? <strong className="text-ok">Dá para quitar tudo.</strong> : <strong className="text-danger">Precisam guardar {dinheiro(p.precisaPorMes)}/mês.</strong>}
          </p>
        )}
      </div>

      <Card titulo="Fornecedores (ordem de pagamento)">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="py-2 font-medium">Fornecedor</th>
                <th className="py-2 font-medium">Categoria</th>
                <th className="py-2 font-medium">Quitar até</th>
                <th className="py-2 text-right font-medium">Total</th>
                <th className="py-2 text-right font-medium">Pago</th>
                <th className="py-2 text-right font-medium">Falta</th>
                <th className="py-2 pl-3 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody className="num">
              {p.fornecedores.map((c) => (
                <tr key={c.fornecedor.id} className="border-t border-line">
                  <td className="py-1.5">{c.fornecedor.nome}</td>
                  <td className="py-1.5 text-muted">{c.fornecedor.categoria}</td>
                  <td className="py-1.5">{c.fornecedor.vencimento ? dataBR(c.fornecedor.vencimento) : "—"}</td>
                  <td className="py-1.5 text-right">{dinheiro(c.fornecedor.valorTotal)}</td>
                  <td className="py-1.5 text-right">{dinheiro(c.pago)}</td>
                  <td className="py-1.5 text-right">{dinheiro(c.restante)}</td>
                  <td className={cx("py-1.5 pl-3 text-xs", c.situacao === "quitado" ? "text-muted" : c.situacao === "da_para_pagar" ? "text-ok" : "text-warn")}>
                    {c.situacao === "quitado" ? "Quitado" : c.situacao === "da_para_pagar" ? "Dá para pagar" : `Falta ${dinheiro(c.falta)}`}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-line font-semibold">
                <td className="py-2" colSpan={3}>
                  Total
                </td>
                <td className="py-2 text-right">{dinheiro(p.totalContratado)}</td>
                <td className="py-2 text-right">{dinheiro(p.totalPago)}</td>
                <td className="py-2 text-right">{dinheiro(p.totalRestante)}</td>
                <td />
              </tr>
            </tbody>
          </table>
          {!p.fornecedores.length && <p className="text-sm text-muted">Nenhum fornecedor cadastrado.</p>}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card titulo={`Tarefas pendentes (${pendentes.length})`}>
          <ul className="space-y-1 text-sm">
            {pendentes.map((t) => (
              <li key={t.id} className="flex justify-between gap-2">
                <span>
                  ☐ {t.titulo} <span className="text-xs text-muted">({t.grupo} · {nome(t.responsavel)})</span>
                </span>
                {t.prazo && <span className={cx("shrink-0 text-xs", t.prazo < hoje ? "text-danger" : "text-muted")}>{dataBR(t.prazo)}</span>}
              </li>
            ))}
            {!pendentes.length && <li className="text-muted">Tudo feito 🎉</li>}
          </ul>
        </Card>
        <Card titulo="Próximos compromissos">
          <ul className="space-y-1 text-sm">
            {eventos.map((e) => (
              <li key={e.id}>
                {TIPOS_EVENTO[e.tipo]?.emoji} <strong>{dataBR(e.data)}</strong> {e.hora} — {e.titulo} {e.local && <span className="text-muted">· {e.local}</span>}
              </li>
            ))}
            {!eventos.length && <li className="text-muted">Nenhum compromisso marcado.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
