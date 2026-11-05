"use client";

import { useState } from "react";
import { useDados } from "@/lib/store";
import { contasDoMes, totaisContas, type ContaDoMes } from "@/lib/calc";
import { dataBR, dataCurta, dinheiro, hojeISO, mesAtual, nomeMes, novoId, parseValor } from "@/lib/format";
import { opsDesfazerConta, opsPagarConta } from "@/lib/ops";
import type { ContaFixa, PessoaId } from "@/lib/types";
import { Check, CircleAlert, CircleCheckBig, Info, Plus, Printer, Trash2 } from "lucide-react";
import { Barra, Botao, Campo, Card, cx, Input, Modal, Select, SeletorMes, SeletorPessoa, Selo, Textarea, Titulo, usePessoas, Vazio } from "@/components/ui";
import { ChipCategoria } from "@/components/icones";

export default function ContasDia6() {
  const { banco, aplicar } = useDados();
  const { nome } = usePessoas();
  const [mes, setMes] = useState(mesAtual());
  const [editando, setEditando] = useState<ContaFixa | "nova" | null>(null);
  const [pagando, setPagando] = useState<ContaDoMes | null>(null);
  const hoje = hojeISO();
  const lista = contasDoMes(banco, mes, hoje);
  const t = totaisContas(lista);
  const inativas = banco.contas.filter((c) => !c.ativa);

  async function alternar(c: ContaDoMes) {
    if (c.pago) {
      await aplicar(opsDesfazerConta(banco, c.conta.id, mes), `${c.conta.nome}: desmarcada`);
    } else {
      const data = mes === mesAtual() ? hoje : c.vencimento;
      await aplicar(opsPagarConta(c.conta, mes, c.conta.valor, data), `${c.conta.nome}: paga`);
    }
  }

  return (
    <div className="space-y-4">
      <Titulo
        area="Finanças"
        titulo={`Contas do dia ${banco.config.diaPadraoContas}`}
        sub="Checklist de tudo que vence no mês — marque conforme for pagando"
        acoes={
          <>
            <SeletorMes mes={mes} setMes={setMes} />
            <Botao variante="secundario" icone={Printer} onClick={() => window.print()} aria-label="Imprimir" />
            <Botao icone={Plus} onClick={() => setEditando("nova")}>
              Conta fixa
            </Botao>
          </>
        }
      />

      {t.qtd > 0 && (
        <section className="avoid-break overflow-hidden rounded-3xl border border-line bg-surface shadow-cartao">
          <div className="grid gap-5 p-5 sm:grid-cols-[1.2fr_1fr] sm:p-6">
            <div>
              <div className="rotulo">{t.falta > 0 ? "Falta pagar" : "Tudo pago"}</div>
              <div className={cx("display num mt-1.5 text-4xl font-medium", t.falta > 0 ? "text-ink" : "text-ok")}>{dinheiro(t.falta)}</div>
              <div className="mt-4">
                <Barra valor={t.qtdPagas} total={t.qtd} cor="bg-ok" altura="h-2.5" />
                <p className="mt-2 text-xs text-muted">
                  <span className="font-semibold text-ink">
                    {t.qtdPagas} de {t.qtd}
                  </span>{" "}
                  contas de {nomeMes(mes)} pagas
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-3 self-center text-sm sm:grid-cols-1 sm:gap-2.5">
              <div className="flex flex-col sm:flex-row sm:justify-between">
                <dt className="text-xs text-muted sm:text-sm">Total do mês</dt>
                <dd className="num font-semibold">{dinheiro(t.total)}</dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between">
                <dt className="text-xs text-muted sm:text-sm">Já pago</dt>
                <dd className="num font-semibold text-ok">{dinheiro(t.pago)}</dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between">
                <dt className="text-xs text-muted sm:text-sm">Atrasadas</dt>
                <dd className={cx("num font-semibold", t.atrasadas ? "text-danger" : "text-muted")}>{t.atrasadas}</dd>
              </div>
            </dl>
          </div>
        </section>
      )}

      {lista.length === 0 ? (
        <Vazio
          icone={CircleCheckBig}
          acao={
            <Botao icone={Plus} onClick={() => setEditando("nova")}>
              Cadastrar conta fixa
            </Botao>
          }
        >
          Cadastre as contas que vocês pagam todo mês (aluguel, luz, internet, faculdade, cartão…). Elas aparecem automaticamente todo mês aqui.
        </Vazio>
      ) : (
        <Card className="overflow-hidden p-0 sm:p-0">
          <ul className="divide-y divide-line">
            {lista.map((c) => {
              const cat = banco.categorias.find((x) => x.id === c.conta.categoriaId);
              return (
                <li key={c.conta.id} className={cx("flex items-center gap-3 px-4 py-3.5 transition", c.pago && "bg-ok-soft/35")}>
                  <button
                    type="button"
                    onClick={() => alternar(c)}
                    aria-label={c.pago ? `Desmarcar ${c.conta.nome}` : `Marcar ${c.conta.nome} como paga`}
                    className={cx(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 transition active:scale-90",
                      c.pago ? "border-ok bg-ok text-white" : c.atrasada ? "border-danger/60 hover:border-danger" : "border-surface-3 hover:border-ok",
                    )}
                  >
                    {c.pago && <Check className="h-4 w-4" strokeWidth={3} />}
                  </button>
                  <ChipCategoria categoria={cat} tamanho="sm" tom={c.pago ? "neutro" : "despesa"} />
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditando(c.conta)}>
                    <span className={cx("block truncate font-medium", c.pago && "text-muted line-through")}>
                      {c.conta.nome}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      vence {dataCurta(c.vencimento)} · {nome(c.conta.pessoa)}
                      {c.pago && c.pagamento && ` · pago em ${dataBR(c.pagamento.pagoEm)}`}
                    </span>
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="num text-sm font-semibold">{dinheiro(c.valor)}</span>
                    {c.pago ? (
                      <button type="button" className="no-print text-xs text-brand" onClick={() => setPagando(c)}>
                        alterar valor
                      </button>
                    ) : c.atrasada ? (
                      <Selo tom="danger" icone={CircleAlert}>
                        atrasada
                      </Selo>
                    ) : (
                      <button type="button" className="no-print text-xs text-brand" onClick={() => setPagando(c)}>
                        pagar outro valor
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <p className="flex gap-2 text-xs text-muted">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" />
        <span>
          Ao marcar uma conta como paga, o sistema cria automaticamente o gasto em Lançamentos. Desmarcar remove o gasto. Toque no nome da conta para editar.
        </span>
      </p>

      {inativas.length > 0 && (
        <Card titulo="Contas desativadas">
          <ul className="space-y-1 text-sm">
            {inativas.map((c) => (
              <li key={c.id} className="flex justify-between">
                <button type="button" className="text-left text-muted hover:text-ink" onClick={() => setEditando(c)}>
                  {c.nome}
                </button>
                <span className="num text-muted">{dinheiro(c.valor)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal aberto={editando !== null} aoFechar={() => setEditando(null)} titulo={editando === "nova" ? "Nova conta fixa" : "Editar conta fixa"}>
        {editando && <FormConta conta={editando === "nova" ? undefined : editando} aoTerminar={() => setEditando(null)} />}
      </Modal>

      <Modal aberto={pagando !== null} aoFechar={() => setPagando(null)} titulo={`Pagar ${pagando?.conta.nome ?? ""}`}>
        {pagando && <FormPagar c={pagando} mes={mes} aoTerminar={() => setPagando(null)} />}
      </Modal>
    </div>
  );
}

function FormPagar({ c, mes, aoTerminar }: { c: ContaDoMes; mes: string; aoTerminar: () => void }) {
  const { aplicar } = useDados();
  const [valor, setValor] = useState(String(c.valor).replace(".", ","));
  const [data, setData] = useState(c.pagamento?.pagoEm ?? (mes === mesAtual() ? hojeISO() : c.vencimento));
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const v = parseValor(valor);
        if (!(v > 0)) return;
        await aplicar(opsPagarConta(c.conta, mes, v, data), "Pagamento registrado");
        aoTerminar();
      }}
    >
      <p className="text-sm text-muted">Valor previsto: {dinheiro(c.conta.valor)}</p>
      <Campo rotulo="Valor pago (R$)">
        <Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus />
      </Campo>
      <Campo rotulo="Data do pagamento">
        <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </Campo>
      <Botao type="submit" className="w-full">
        Marcar como paga
      </Botao>
    </form>
  );
}

function FormConta({ conta, aoTerminar }: { conta?: ContaFixa; aoTerminar: () => void }) {
  const { banco, aplicar } = useDados();
  const [f, setF] = useState<ContaFixa>(
    conta ?? {
      id: novoId(),
      nome: "",
      valor: 0,
      categoriaId: "cat-aluguel",
      dia: banco.config.diaPadraoContas,
      pessoa: "casal",
      ativa: true,
      observacao: "",
    },
  );
  const [valor, setValor] = useState(conta ? String(conta.valor).replace(".", ",") : "");
  const set = <K extends keyof ContaFixa>(k: K, v: ContaFixa[K]) => setF((x) => ({ ...x, [k]: v }));

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const v = parseValor(valor);
        if (!f.nome.trim() || !(v >= 0)) return;
        await aplicar([{ tipo: "upsert", colecao: "contas", id: f.id, dados: { ...f, nome: f.nome.trim(), valor: v || 0 } }], "Conta salva");
        aoTerminar();
      }}
    >
      <Campo rotulo="Nome da conta">
        <Input value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="ex.: Aluguel, Luz, Internet" required autoFocus={!conta} />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Valor previsto (R$)" dica="Valor médio; ao pagar dá para ajustar">
          <Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
        </Campo>
        <Campo rotulo="Dia do vencimento">
          <Input type="number" min={1} max={31} value={f.dia} onChange={(e) => set("dia", Number(e.target.value))} />
        </Campo>
      </div>
      <Campo rotulo="Categoria">
        <Select value={f.categoriaId} onChange={(e) => set("categoriaId", e.target.value)}>
          {banco.categorias
            .filter((c) => c.tipo === "despesa")
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
        </Select>
      </Campo>
      <div>
        <span className="mb-1 block text-xs font-medium text-muted">Quem paga</span>
        <SeletorPessoa valor={f.pessoa} onChange={(v) => set("pessoa", v as PessoaId)} />
      </div>
      <Campo rotulo="Observação">
        <Textarea rows={2} value={f.observacao} onChange={(e) => set("observacao", e.target.value)} placeholder="ex.: débito automático, boleto no e-mail…" />
      </Campo>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={f.ativa} onChange={(e) => set("ativa", e.target.checked)} className="h-5 w-5 accent-[var(--brand)]" />
        Ativa (aparece todo mês)
      </label>
      <div className="flex gap-2">
        {conta && (
          <Botao
            variante="perigo"
            icone={Trash2}
            onClick={async () => {
              if (!confirm("Excluir esta conta? Os gastos já lançados continuam em Lançamentos.")) return;
              await aplicar(
                [
                  { tipo: "delete", colecao: "contas", id: conta.id },
                  ...banco.pagamentosContas.filter((p) => p.contaId === conta.id).map((p) => ({ tipo: "delete" as const, colecao: "pagamentosContas" as const, id: p.id })),
                ],
                "Conta excluída",
              );
              aoTerminar();
            }}
          >
            Excluir
          </Botao>
        )}
        <Botao type="submit" className="flex-1">
          Salvar
        </Botao>
      </div>
    </form>
  );
}
