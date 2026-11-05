"use client";

import { useState } from "react";
import { useDados } from "@/lib/store";
import { contasDoMes, totaisContas, type ContaDoMes } from "@/lib/calc";
import { dataBR, dataCurta, dinheiro, hojeISO, mesAtual, nomeMes, novoId, parseValor } from "@/lib/format";
import { opsDesfazerConta, opsPagarConta } from "@/lib/ops";
import type { ContaFixa, PessoaId } from "@/lib/types";
import { Barra, Botao, Campo, Card, cx, Input, Modal, Select, SeletorMes, SeletorPessoa, Selo, Stat, Textarea, Titulo, usePessoas, Vazio } from "@/components/ui";

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
      await aplicar(opsPagarConta(c.conta, mes, c.conta.valor, data), `${c.conta.nome}: paga ✅`);
    }
  }

  return (
    <div className="space-y-4">
      <Titulo
        titulo={`Contas do dia ${banco.config.diaPadraoContas}`}
        sub="Checklist de tudo que vence no mês — marque conforme for pagando"
        acoes={
          <>
            <SeletorMes mes={mes} setMes={setMes} />
            <Botao variante="secundario" onClick={() => window.print()}>
              🖨️
            </Botao>
            <Botao onClick={() => setEditando("nova")}>+ Conta fixa</Botao>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat rotulo="Total do mês" valor={dinheiro(t.total)} detalhe={`${t.qtd} conta(s)`} />
        <Stat rotulo="Já pago" cor="bg-ok" valor={dinheiro(t.pago)} detalhe={`${t.qtdPagas} de ${t.qtd}`} />
        <Stat rotulo="Falta pagar" cor="bg-despesa" valor={<span className={t.falta > 0 ? "text-danger" : "text-ok"}>{dinheiro(t.falta)}</span>} detalhe={`${t.qtd - t.qtdPagas} pendente(s)`} destaque />
        <Stat rotulo="Atrasadas" valor={t.atrasadas} detalhe={t.atrasadas ? "venceram e não foram marcadas" : "nenhuma 🎉"} />
      </div>

      {t.qtd > 0 && (
        <div>
          <Barra valor={t.qtdPagas} total={t.qtd} cor="bg-ok" altura="h-3" />
          <p className="mt-1 text-xs text-muted">
            {Math.round((t.qtdPagas / t.qtd) * 100)}% das contas de {nomeMes(mes)} pagas
          </p>
        </div>
      )}

      {lista.length === 0 ? (
        <Vazio acao={<Botao onClick={() => setEditando("nova")}>+ Cadastrar conta fixa</Botao>}>
          Cadastre as contas que vocês pagam todo mês (aluguel, luz, internet, faculdade, cartão…). Elas aparecem automaticamente todo mês aqui.
        </Vazio>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {lista.map((c) => {
              const cat = banco.categorias.find((x) => x.id === c.conta.categoriaId);
              return (
                <li key={c.conta.id} className={cx("flex items-center gap-3 px-4 py-3", c.pago && "bg-ok-soft/40")}>
                  <button
                    type="button"
                    onClick={() => alternar(c)}
                    aria-label={c.pago ? `Desmarcar ${c.conta.nome}` : `Marcar ${c.conta.nome} como paga`}
                    className={cx(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 text-lg font-bold transition",
                      c.pago ? "border-ok bg-ok text-white" : c.atrasada ? "border-danger" : "border-line hover:border-ok",
                    )}
                  >
                    {c.pago ? "✓" : ""}
                  </button>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditando(c.conta)}>
                    <span className={cx("block truncate font-medium", c.pago && "text-muted line-through")}>
                      {cat?.emoji} {c.conta.nome}
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
                      <Selo tom="danger">atrasada</Selo>
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

      <p className="text-xs text-muted">
        💡 Ao marcar uma conta como paga, o sistema cria automaticamente o gasto em Lançamentos. Desmarcar remove o gasto. Pelo WhatsApp: <code>paguei luz</code> ou <code>paguei luz 187,30</code>.
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
        await aplicar(opsPagarConta(c.conta, mes, v, data), "Pagamento registrado ✅");
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
                {c.emoji} {c.nome}
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
