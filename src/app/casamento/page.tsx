"use client";

import Link from "next/link";
import {
  CalendarDays,
  CircleAlert,
  CircleCheckBig,
  FileText,
  Gem,
  HandCoins,
  Hourglass,
  ListChecks,
  PiggyBank,
  Printer,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useDados } from "@/lib/store";
import { planoCasamento } from "@/lib/calc";
import { dataBR, dataCurta, diasEntre, dinheiro, hojeISO, mesAtual, pct } from "@/lib/format";
import { Barra, Botao, Card, cx, Selo, Stat, Titulo, Vazio } from "@/components/ui";
import { BarraEmpilhada, Ranking } from "@/components/graficos";
import { ICONES_EVENTO } from "@/components/icones";
import { Monograma } from "@/components/shell";

const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

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
    .filter((e) => e.data >= hoje && (e.area ?? "casamento") === "casamento")
    .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora))
    .slice(0, 5);
  const proxVenc = p.fornecedores.filter((f) => !f.quitado && f.situacao !== "sem_valor").slice(0, 5);

  const porCategoria = new Map<string, number>();
  for (const f of banco.fornecedores) porCategoria.set(f.categoria || "Outros", (porCategoria.get(f.categoria || "Outros") ?? 0) + f.valorTotal);
  const dataExtenso = data ? `${Number(data.slice(8))} de ${MESES_LONGOS[Number(data.slice(5, 7)) - 1]} de ${data.slice(0, 4)}` : "";

  return (
    <div className="space-y-5">
      <Titulo
        area="Casamento"
        titulo="Nosso casamento"
        sub={`${banco.config.nomeP1} & ${banco.config.nomeP2}`}
        acoes={
          <Botao variante="secundario" icone={Printer} onClick={() => window.print()}>
            Imprimir
          </Botao>
        }
      />

      {/* ===== Contagem regressiva ===== */}
      <section className="avoid-break relative overflow-hidden rounded-3xl border border-gold/25 bg-gold-soft p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-gold/20" aria-hidden />
        <div className="pointer-events-none absolute -right-4 top-10 h-36 w-36 rounded-full border border-gold/20" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="rotulo text-gold">{dias === null ? "Data a definir" : dias > 0 ? "Faltam" : dias === 0 ? "É hoje" : "Casados há"}</div>
            {dias !== null ? (
              <div className="display mt-1 flex items-baseline gap-3">
                <span className="num text-6xl font-medium leading-none sm:text-7xl">{Math.abs(dias)}</span>
                <span className="text-2xl italic text-muted">dias</span>
              </div>
            ) : (
              <Link href="/ajustes" className="display mt-2 block text-2xl text-brand underline-offset-4 hover:underline">
                Definir a data em Ajustes
              </Link>
            )}
            {data && <div className="mt-3 text-sm text-muted">{dataExtenso}</div>}
          </div>
          <div className="sm:text-right">
            <div className="hidden sm:block">
              <Monograma grande />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 sm:justify-end">
              <Selo tom="gold" icone={ListChecks}>
                {feitas}/{tarefas.length} tarefas
              </Selo>
              {p.totalContratado > 0 && (
                <Selo tom="gold" icone={Receipt}>
                  {pct(p.totalPago / p.totalContratado)} pago
                </Selo>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icone={FileText}
          rotulo="Contratado"
          valor={dinheiro(p.totalContratado)}
          detalhe={banco.config.orcamentoCasamento > 0 ? `orçamento ${dinheiro(banco.config.orcamentoCasamento)}` : `${banco.fornecedores.length} fornecedores`}
        />
        <Stat icone={CircleCheckBig} tom="ok" rotulo="Já pago" valor={dinheiro(p.totalPago)} detalhe={p.totalContratado > 0 ? `${pct(p.totalPago / p.totalContratado)} do contratado` : undefined} />
        <Stat icone={PiggyBank} tom="guardado" rotulo="Reserva disponível" valor={dinheiro(p.disponivel)} detalhe={`guardado ${dinheiro(p.guardado)}`} />
        <Stat
          icone={Hourglass}
          tom={p.faltaGuardar > 0 ? "despesa" : "ok"}
          rotulo="Falta guardar"
          valor={<span className={p.faltaGuardar > 0 ? "text-danger" : "text-ok"}>{dinheiro(p.faltaGuardar)}</span>}
          detalhe={p.faltaGuardar > 0 ? "para quitar tudo" : "a reserva já cobre tudo"}
        />
      </div>

      {banco.config.orcamentoCasamento > 0 && p.totalContratado > banco.config.orcamentoCasamento && (
        <div className="flex items-center gap-2 rounded-2xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger">
          <CircleAlert className="h-4 w-4 shrink-0" />
          O total contratado passou do orçamento em {dinheiro(p.totalContratado - banco.config.orcamentoCasamento)}.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card
          titulo="Situação dos pagamentos"
          icone={Wallet}
          className="lg:col-span-2"
          acao={
            <Link href="/casamento/fornecedores" className="no-print text-xs font-medium text-brand">
              Fornecedores
            </Link>
          }
        >
          {p.totalContratado > 0 ? (
            <>
              <BarraEmpilhada
                partes={[
                  { nome: "Já pago", valor: p.totalPago, cor: "var(--ok)" },
                  { nome: "Dá p/ pagar com a reserva", valor: p.valorDaParaPagar, cor: "var(--guardado)" },
                  { nome: "Ainda falta dinheiro", valor: p.totalRestante - p.valorDaParaPagar, cor: "var(--despesa)", textura: true },
                ]}
              />
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <ListaSituacao titulo="Já dá para pagar" icone={CircleCheckBig} tom="ok" itens={p.daParaPagar.map((f) => [f.fornecedor.id, f.fornecedor.nome, f.restante])} vazio="Nenhum ainda" />
                <ListaSituacao titulo="Falta dinheiro" icone={Hourglass} tom="warn" itens={p.faltam.map((f) => [f.fornecedor.id, f.fornecedor.nome, f.restante])} vazio="Nenhum" />
              </div>
            </>
          ) : (
            <Vazio
              icone={HandCoins}
              acao={
                <Link href="/casamento/fornecedores">
                  <Botao>Cadastrar fornecedores</Botao>
                </Link>
              }
            >
              Cadastre os fornecedores para ver o que já dá para pagar.
            </Vazio>
          )}
        </Card>

        <Card titulo="Projeção" icone={TrendingUp}>
          {data ? (
            <div className="space-y-2.5 text-sm">
              <Linha rotulo="Ritmo mensal" valor={dinheiro(p.ritmo)} />
              <p className="-mt-1 text-xs text-muted">{banco.config.metaMensalGuardar > 0 ? "meta definida em Ajustes" : "média guardada nos últimos 3 meses"}</p>
              <Linha rotulo="Terão no casamento" valor={dinheiro(p.projecaoNoCasamento)} />
              <Linha rotulo="Precisam ter" valor={dinheiro(p.totalRestante)} />
              <Barra valor={p.projecaoNoCasamento} total={Math.max(p.totalRestante, 1)} cor={p.vaiDar ? "bg-ok" : "bg-despesa"} />
              {p.totalRestante > 0 && (
                <div className={cx("mt-2 rounded-xl p-3", p.vaiDar ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger")}>
                  {p.vaiDar ? "No ritmo atual, dá para quitar tudo até o casamento." : `No ritmo atual faltarão ${dinheiro(p.totalRestante - p.projecaoNoCasamento)}.`}
                  {p.faltaGuardar > 0 && p.mesesRestantes > 0 && (
                    <div className="mt-1 text-ink">
                      Mínimo necessário: <strong className="num">{dinheiro(p.precisaPorMes)}/mês</strong>
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card titulo="Próximos pagamentos" icone={Receipt}>
          {proxVenc.length ? (
            <ul className="space-y-3 text-sm">
              {proxVenc.map((f) => (
                <li key={f.fornecedor.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{f.fornecedor.nome}</span>
                    <span className="text-xs text-muted">{f.fornecedor.vencimento ? `até ${dataBR(f.fornecedor.vencimento)}` : "sem data definida"}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="num">{dinheiro(f.restante)}</span>
                    {f.situacao === "da_para_pagar" ? <Selo tom="ok">dá p/ pagar</Selo> : <Selo tom="warn">falta {dinheiro(f.falta)}</Selo>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nada pendente.</p>
          )}
        </Card>

        <Card
          titulo="Tarefas"
          icone={ListChecks}
          acao={
            <Link href="/casamento/organizacao" className="no-print text-xs font-medium text-brand">
              Ver todas
            </Link>
          }
        >
          <Barra valor={feitas} total={tarefas.length} cor="bg-ok" />
          <p className="mb-3 mt-1.5 text-xs text-muted">
            {feitas} de {tarefas.length} concluídas
          </p>
          <ul className="space-y-2 text-sm">
            {proxTarefas.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-4 w-4 shrink-0 rounded-full border-2 border-surface-3" aria-hidden />
                  <span className="truncate">{t.titulo}</span>
                </span>
                {t.prazo && <span className={cx("shrink-0 text-xs", t.prazo < hoje ? "font-medium text-danger" : "text-muted")}>{dataCurta(t.prazo)}</span>}
              </li>
            ))}
          </ul>
        </Card>

        <Card
          titulo="Agenda"
          icone={CalendarDays}
          acao={
            <Link href="/casamento/calendario" className="no-print text-xs font-medium text-brand">
              Calendário
            </Link>
          }
        >
          {proxEventos.length ? (
            <ul className="space-y-3 text-sm">
              {proxEventos.map((e) => {
                const Icone = ICONES_EVENTO[e.tipo] ?? CalendarDays;
                return (
                  <li key={e.id} className="flex gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                      <Icone className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{e.titulo}</span>
                      <span className="text-xs text-muted">
                        {dataBR(e.data)} {e.hora} {e.local && `· ${e.local}`}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nenhum compromisso marcado.</p>
          )}
        </Card>
      </div>

      {porCategoria.size > 0 && (
        <Card titulo="Para onde vai o orçamento" icone={Gem}>
          <Ranking
            cor="var(--brand)"
            itens={[...porCategoria.entries()]
              .filter(([, v]) => v > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([nome, valor]) => ({ chave: nome, rotulo: nome, valor }))}
          />
        </Card>
      )}
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{rotulo}</span>
      <span className="num font-medium">{valor}</span>
    </div>
  );
}

function ListaSituacao({
  titulo,
  icone: Icone,
  tom,
  itens,
  vazio,
}: {
  titulo: string;
  icone: typeof Wallet;
  tom: "ok" | "warn";
  itens: [string, string, number][];
  vazio: string;
}) {
  return (
    <div className={cx("rounded-2xl p-4", tom === "ok" ? "bg-ok-soft" : "bg-warn-soft")}>
      <div className={cx("mb-2 flex items-center gap-1.5 text-sm font-semibold", tom === "ok" ? "text-ok" : "text-warn")}>
        <Icone className="h-4 w-4" /> {titulo} <span className="font-normal opacity-70">({itens.length})</span>
      </div>
      <ul className="space-y-1 text-sm">
        {itens.slice(0, 5).map(([id, nome, v]) => (
          <li key={id} className="flex justify-between gap-2">
            <span className="truncate">{nome}</span>
            <span className="num">{dinheiro(v)}</span>
          </li>
        ))}
        {itens.length > 5 && <li className="text-xs text-muted">+ {itens.length - 5} outros</li>}
        {!itens.length && <li className="text-muted">{vazio}</li>}
      </ul>
    </div>
  );
}
