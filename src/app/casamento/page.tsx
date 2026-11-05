"use client";

import Link from "next/link";
import { useDados } from "@/lib/store";
import { planoCasamento } from "@/lib/calc";
import { dataBR, dataCurta, diasEntre, dinheiro, hojeISO, mesAtual, pct } from "@/lib/format";
import { TIPOS_EVENTO } from "@/lib/defaults";
import { Barra, Botao, Card, Selo, Stat, Titulo, Vazio } from "@/components/ui";
import { BarraEmpilhada, Ranking } from "@/components/graficos";

export default function PainelCasamento() {
  const { banco } = useDados();
  const hoje = hojeISO();
  const p = planoCasamento(banco, mesAtual());
  const data = banco.config.dataCasamento;
  const dias = data ? diasEntre(hoje, data) : null;

  const tarefas = banco.tarefas;
  const feitas = tarefas.filter((t) => t.feita).length;
  const proxTarefas = tarefas
    .filter((t) => !t.feita)
    .sort((a, b) => (a.prazo || "9999").localeCompare(b.prazo || "9999"))
    .slice(0, 5);
  const proxEventos = banco.eventos
    .filter((e) => e.data >= hoje)
    .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora))
    .slice(0, 5);
  const proxVenc = p.fornecedores.filter((f) => !f.quitado && f.fornecedor.vencimento).slice(0, 5);

  const porCategoria = new Map<string, number>();
  for (const f of banco.fornecedores) porCategoria.set(f.categoria || "Outros", (porCategoria.get(f.categoria || "Outros") ?? 0) + f.valorTotal);

  return (
    <div className="space-y-4">
      <Titulo
        titulo="Painel do casamento"
        sub={data ? `Casamento em ${dataBR(data)}` : <Link href="/ajustes" className="text-brand">Defina a data do casamento em Ajustes →</Link>}
        acoes={
          <Botao variante="secundario" onClick={() => window.print()}>
            🖨️ Imprimir
          </Botao>
        }
      />

      {dias !== null && (
        <div className="avoid-break rounded-3xl bg-brand p-5 text-brand-ink">
          <div className="text-sm opacity-80">{dias > 0 ? "Faltam" : dias === 0 ? "É hoje!" : "Casados há"}</div>
          <div className="num text-4xl font-bold">{Math.abs(dias)} dias</div>
          <div className="mt-1 text-sm opacity-80">
            {p.mesesRestantes > 0 ? `${p.mesesRestantes} mês(es) contando este` : ""} · {feitas}/{tarefas.length} tarefas concluídas
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat rotulo="Contratado com fornecedores" valor={dinheiro(p.totalContratado)} detalhe={banco.config.orcamentoCasamento > 0 ? `orçamento: ${dinheiro(banco.config.orcamentoCasamento)}` : `${banco.fornecedores.length} fornecedor(es)`} />
        <Stat rotulo="Já pago" cor="bg-ok" valor={dinheiro(p.totalPago)} detalhe={p.totalContratado > 0 ? `${pct(p.totalPago / p.totalContratado)} do contratado` : undefined} />
        <Stat rotulo="Reserva disponível" cor="bg-guardado" valor={dinheiro(p.disponivel)} detalhe={`guardado total ${dinheiro(p.guardado)}`} />
        <Stat
          rotulo="Falta guardar"
          cor="bg-despesa"
          valor={<span className={p.faltaGuardar > 0 ? "text-danger" : "text-ok"}>{dinheiro(p.faltaGuardar)}</span>}
          detalhe={p.faltaGuardar > 0 ? "para quitar todos os fornecedores" : "a reserva já cobre tudo 🎉"}
          destaque
        />
      </div>

      {banco.config.orcamentoCasamento > 0 && p.totalContratado > banco.config.orcamentoCasamento && (
        <div className="rounded-2xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          ⚠️ O total contratado ({dinheiro(p.totalContratado)}) passou do orçamento ({dinheiro(banco.config.orcamentoCasamento)}) em{" "}
          {dinheiro(p.totalContratado - banco.config.orcamentoCasamento)}.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card titulo="Situação dos pagamentos" className="lg:col-span-2" acao={<Link href="/casamento/fornecedores" className="no-print text-xs text-brand">Fornecedores →</Link>}>
          {p.totalContratado > 0 ? (
            <>
              <BarraEmpilhada
                partes={[
                  { nome: "Já pago", valor: p.totalPago, cor: "var(--ok)" },
                  { nome: "Dá p/ pagar com a reserva", valor: p.valorDaParaPagar, cor: "var(--guardado)" },
                  { nome: "Ainda falta dinheiro", valor: p.totalRestante - p.valorDaParaPagar, cor: "var(--despesa)", textura: true },
                ]}
              />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-ok-soft p-3">
                  <div className="text-sm font-semibold text-ok">✅ Já dá para pagar ({p.daParaPagar.length})</div>
                  <ul className="mt-1 space-y-0.5 text-sm">
                    {p.daParaPagar.slice(0, 5).map((f) => (
                      <li key={f.fornecedor.id} className="flex justify-between gap-2">
                        <span className="truncate">{f.fornecedor.nome}</span>
                        <span className="num">{dinheiro(f.restante)}</span>
                      </li>
                    ))}
                    {!p.daParaPagar.length && <li className="text-muted">Nenhum ainda</li>}
                  </ul>
                </div>
                <div className="rounded-xl bg-warn-soft p-3">
                  <div className="text-sm font-semibold text-warn">⏳ Falta dinheiro ({p.faltam.length})</div>
                  <ul className="mt-1 space-y-0.5 text-sm">
                    {p.faltam.slice(0, 5).map((f) => (
                      <li key={f.fornecedor.id} className="flex justify-between gap-2">
                        <span className="truncate">{f.fornecedor.nome}</span>
                        <span className="num">{dinheiro(f.restante)}</span>
                      </li>
                    ))}
                    {!p.faltam.length && <li className="text-muted">Nenhum 🎉</li>}
                  </ul>
                </div>
              </div>
            </>
          ) : (
            <Vazio acao={<Link href="/casamento/fornecedores"><Botao>Cadastrar fornecedores</Botao></Link>}>
              Cadastre os fornecedores (ou importe a planilha) para ver o que já dá para pagar.
            </Vazio>
          )}
        </Card>

        <Card titulo="📈 Projeção até o casamento">
          {data ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Ritmo mensal</span>
                <span className="num font-medium">{dinheiro(p.ritmo)}</span>
              </div>
              <p className="text-xs text-muted">{banco.config.metaMensalGuardar > 0 ? "meta definida em Ajustes" : "média guardada nos últimos 3 meses"}</p>
              <div className="flex justify-between">
                <span className="text-muted">Terão no casamento</span>
                <span className="num font-medium">{dinheiro(p.projecaoNoCasamento)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Precisam ter</span>
                <span className="num font-medium">{dinheiro(p.totalRestante)}</span>
              </div>
              <Barra valor={p.projecaoNoCasamento} total={Math.max(p.totalRestante, 1)} cor={p.vaiDar ? "bg-ok" : "bg-despesa"} />
              {p.totalRestante > 0 && (
                <div className={`rounded-xl p-3 ${p.vaiDar ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}>
                  {p.vaiDar ? "✅ No ritmo atual, dá para quitar tudo até o casamento." : `⚠️ No ritmo atual faltarão ${dinheiro(p.totalRestante - p.projecaoNoCasamento)}.`}
                  {p.faltaGuardar > 0 && p.mesesRestantes > 0 && (
                    <div className="mt-1 text-ink">
                      Mínimo necessário: guardar <strong>{dinheiro(p.precisaPorMes)}/mês</strong> até o casamento.
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">Defina a data do casamento em Ajustes.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card titulo="Próximos vencimentos">
          {proxVenc.length ? (
            <ul className="space-y-2 text-sm">
              {proxVenc.map((f) => (
                <li key={f.fornecedor.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate">{f.fornecedor.nome}</span>
                    <span className="text-xs text-muted">vence {dataBR(f.fornecedor.vencimento)}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end">
                    <span className="num">{dinheiro(f.restante)}</span>
                    {f.situacao === "da_para_pagar" ? <Selo tom="ok">dá p/ pagar</Selo> : <Selo tom="warn">falta {dinheiro(f.falta)}</Selo>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nada pendente com data.</p>
          )}
        </Card>

        <Card titulo="Tarefas" acao={<Link href="/casamento/organizacao" className="no-print text-xs text-brand">Ver todas →</Link>}>
          <Barra valor={feitas} total={tarefas.length} cor="bg-ok" />
          <p className="mb-2 mt-1 text-xs text-muted">
            {feitas} de {tarefas.length} concluídas
          </p>
          <ul className="space-y-1.5 text-sm">
            {proxTarefas.map((t) => (
              <li key={t.id} className="flex justify-between gap-2">
                <span className="truncate">☐ {t.titulo}</span>
                {t.prazo && <span className={`shrink-0 text-xs ${t.prazo < hoje ? "text-danger" : "text-muted"}`}>{dataCurta(t.prazo)}</span>}
              </li>
            ))}
          </ul>
        </Card>

        <Card titulo="Agenda" acao={<Link href="/casamento/calendario" className="no-print text-xs text-brand">Calendário →</Link>}>
          {proxEventos.length ? (
            <ul className="space-y-2 text-sm">
              {proxEventos.map((e) => (
                <li key={e.id} className="flex gap-2">
                  <span>{TIPOS_EVENTO[e.tipo]?.emoji}</span>
                  <span className="min-w-0">
                    <span className="block truncate">{e.titulo}</span>
                    <span className="text-xs text-muted">
                      {dataBR(e.data)} {e.hora} {e.local && `· ${e.local}`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nenhum compromisso marcado.</p>
          )}
        </Card>
      </div>

      {porCategoria.size > 0 && (
        <Card titulo="Para onde vai o orçamento">
          <Ranking
            cor="var(--brand)"
            itens={[...porCategoria.entries()].sort((a, b) => b[1] - a[1]).map(([nome, valor]) => ({ chave: nome, rotulo: nome, valor }))}
          />
        </Card>
      )}
    </div>
  );
}
