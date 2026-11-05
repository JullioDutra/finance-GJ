"use client";

import { useState } from "react";
import { useDados } from "@/lib/store";
import { planoCasamento, type FornecedorCalc } from "@/lib/calc";
import { dataBR, dinheiro, hojeISO, mesAtual, novoId, parseValor } from "@/lib/format";
import { CATEGORIAS_FORNECEDOR, orcamentoInicial } from "@/lib/defaults";
import { lerPlanilha } from "@/lib/planilha";
import type { Op } from "@/lib/ops";
import type { Fornecedor, PagamentoFornecedor } from "@/lib/types";
import { Barra, Botao, Campo, cx, Input, Modal, Select, Selo, Stat, Textarea, Titulo, Vazio } from "@/components/ui";

export default function Fornecedores() {
  const { banco } = useDados();
  const [editar, setEditar] = useState<Fornecedor | "novo" | null>(null);
  const [pagar, setPagar] = useState<FornecedorCalc | null>(null);
  const [importar, setImportar] = useState(false);
  const p = planoCasamento(banco, mesAtual());
  const quitados = p.fornecedores.filter((f) => f.situacao === "quitado");
  const temPlanilha = banco.fornecedores.some((f) => f.id.startsWith("forn-"));
  const { aplicar } = useDados();
  async function carregarPlanilha() {
    const { fornecedores, pagamentos } = orcamentoInicial();
    await aplicar(
      [
        ...fornecedores.map((f): Op => ({ tipo: "upsert", colecao: "fornecedores", id: f.id, dados: f })),
        ...pagamentos.map((pg): Op => ({ tipo: "upsert", colecao: "pagamentosFornecedores", id: pg.id, dados: pg })),
      ],
      `${fornecedores.length} orçamentos carregados`,
    );
  }

  return (
    <div className="space-y-4">
      <Titulo
        titulo="Fornecedores"
        sub="O que já dá para pagar com o que vocês têm guardado e o que ainda falta"
        acoes={
          <>
            <Botao variante="secundario" onClick={() => setImportar(true)}>
              📥 Importar planilha
            </Botao>
            <Botao onClick={() => setEditar("novo")}>+ Fornecedor</Botao>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat rotulo="Reserva disponível" cor="bg-guardado" valor={dinheiro(p.disponivel)} detalhe="guardado − pago com a reserva" />
        <Stat rotulo="Falta pagar (total)" valor={dinheiro(p.totalRestante)} detalhe={`de ${dinheiro(p.totalContratado)} contratados`} />
        <Stat rotulo="Dá para pagar agora" cor="bg-ok" valor={dinheiro(p.valorDaParaPagar)} detalhe={`${p.daParaPagar.length} fornecedor(es)`} />
        <Stat
          rotulo="Falta guardar"
          cor="bg-despesa"
          valor={<span className={p.faltaGuardar > 0 ? "text-danger" : "text-ok"}>{dinheiro(p.faltaGuardar)}</span>}
          detalhe={p.sobraDepoisDeQuitar > 0 ? `sobram ${dinheiro(p.sobraDepoisDeQuitar)} depois de quitar tudo` : `${p.faltam.length} fornecedor(es) aguardando`}
          destaque
        />
      </div>

      {!temPlanilha && (
        <div className="no-print flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand/30 bg-brand-soft p-3 text-sm">
          <span>📄 Carregar os 15 itens da planilha “Orçamentos” (Decoração, Fotos/Vídeo, Dia da Noiva…)</span>
          <Botao pequeno onClick={carregarPlanilha}>Carregar orçamentos</Botao>
        </div>
      )}

      <p className="text-xs text-muted">
        Como funciona: os fornecedores são ordenados pelo vencimento (e prioridade). O sistema vai “reservando” o dinheiro disponível para cada um; se o que falta pagar cabe no saldo,
        ele aparece em <strong>Já dá para pagar</strong>. Para registrar o guardado do mês, lance um <strong>“Guardar”</strong> nas Finanças (ou mande <code>guardei 500</code> no WhatsApp).
      </p>

      {banco.fornecedores.length === 0 ? (
        <Vazio
          acao={
            <div className="flex justify-center gap-2">
              <Botao variante="secundario" onClick={() => setImportar(true)}>
                📥 Importar planilha
              </Botao>
              <Botao onClick={() => setEditar("novo")}>+ Fornecedor</Botao>
            </div>
          }
        >
          Nenhum fornecedor cadastrado ainda.
        </Vazio>
      ) : (
        <>
          <Secao titulo={`✅ Já dá para pagar com o que temos (${p.daParaPagar.length})`} tom="ok" itens={p.daParaPagar} onPagar={setPagar} onEditar={setEditar} vazio="Nenhum fornecedor cabe na reserva atual." />
          <Secao titulo={`⏳ Ainda falta dinheiro (${p.faltam.length})`} tom="warn" itens={p.faltam} onPagar={setPagar} onEditar={setEditar} vazio="Nenhum — a reserva cobre todos! 🎉" />
          {p.semValor.length > 0 && (
            <Secao titulo={`📝 Sem valor definido (${p.semValor.length})`} tom="neutro" itens={p.semValor} onPagar={setPagar} onEditar={setEditar} vazio="" />
          )}
          {quitados.length > 0 && <Secao titulo={`🎉 Quitados (${quitados.length})`} tom="neutro" itens={quitados} onPagar={setPagar} onEditar={setEditar} vazio="" />}
        </>
      )}

      <Modal aberto={editar !== null} aoFechar={() => setEditar(null)} titulo={editar === "novo" ? "Novo fornecedor" : "Editar fornecedor"}>
        {editar && <FormFornecedor f={editar === "novo" ? undefined : editar} aoTerminar={() => setEditar(null)} />}
      </Modal>
      <Modal aberto={pagar !== null} aoFechar={() => setPagar(null)} titulo={`Pagamentos — ${pagar?.fornecedor.nome ?? ""}`}>
        {pagar && <FormPagamento c={pagar} aoTerminar={() => setPagar(null)} />}
      </Modal>
      <Modal aberto={importar} aoFechar={() => setImportar(false)} titulo="Importar fornecedores da planilha">
        {importar && <Importar aoTerminar={() => setImportar(false)} />}
      </Modal>
    </div>
  );
}

function Secao({
  titulo,
  tom,
  itens,
  onPagar,
  onEditar,
  vazio,
}: {
  titulo: string;
  tom: "ok" | "warn" | "neutro";
  itens: FornecedorCalc[];
  onPagar: (c: FornecedorCalc) => void;
  onEditar: (f: Fornecedor) => void;
  vazio: string;
}) {
  const hoje = hojeISO();
  return (
    <section>
      <h2 className={cx("mb-2 text-sm font-semibold", tom === "ok" ? "text-ok" : tom === "warn" ? "text-warn" : "text-muted")}>{titulo}</h2>
      {itens.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">{vazio}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {itens.map((c) => {
            const f = c.fornecedor;
            const vencido = !c.quitado && f.vencimento && f.vencimento < hoje;
            return (
              <div key={f.id} className="avoid-break rounded-2xl border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <button type="button" onClick={() => onEditar(f)} className="block truncate text-left font-semibold hover:text-brand">
                      {f.nome}
                    </button>
                    <div className="text-xs text-muted">
                      {f.categoria}
                      {f.contato && ` · ${f.contato}`}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {f.prioridade === 1 && <Selo tom="brand">prioridade alta</Selo>}
                    {vencido && <Selo tom="danger">vencido</Selo>}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-muted">Total</div>
                    <div className="num font-medium">{dinheiro(f.valorTotal)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Pago</div>
                    <div className="num font-medium text-ok">{dinheiro(c.pago)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Falta</div>
                    <div className="num font-medium">{dinheiro(c.restante)}</div>
                  </div>
                </div>
                <div className="mt-2">
                  <Barra valor={c.pago} total={f.valorTotal} cor="bg-ok" />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-muted">{f.vencimento ? `Quitar até ${dataBR(f.vencimento)}` : "Sem data de vencimento"}</span>
                  {c.situacao === "falta" && (
                    <span className="text-warn">
                      faltam <strong className="num">{dinheiro(c.falta)}</strong> na reserva
                      {c.saldoAntes > 0 && ` (dá p/ adiantar ${dinheiro(c.saldoAntes)})`}
                    </span>
                  )}
                  {c.situacao === "da_para_pagar" && <span className="text-ok">reserva cobre ✔</span>}
                  {c.situacao === "sem_valor" && <span className="text-muted">toque em Editar para informar o valor</span>}
                </div>
                {f.observacao && <p className="mt-2 text-xs text-muted">📝 {f.observacao}</p>}
                <div className="no-print mt-3 flex gap-2">
                  <Botao pequeno variante={c.quitado ? "secundario" : "primario"} onClick={() => onPagar(c)} className="flex-1">
                    {c.quitado ? "Ver pagamentos" : "💸 Registrar pagamento"}
                  </Botao>
                  <Botao pequeno variante="secundario" onClick={() => onEditar(f)}>
                    Editar
                  </Botao>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function FormFornecedor({ f: inicial, aoTerminar }: { f?: Fornecedor; aoTerminar: () => void }) {
  const { banco, aplicar } = useDados();
  const [f, setF] = useState<Fornecedor>(
    inicial ?? { id: novoId(), nome: "", categoria: "Buffet", contato: "", valorTotal: 0, vencimento: "", prioridade: 2, observacao: "" },
  );
  const [valor, setValor] = useState(inicial ? String(inicial.valorTotal).replace(".", ",") : "");
  const set = <K extends keyof Fornecedor>(k: K, v: Fornecedor[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const v = parseValor(valor);
        if (!f.nome.trim() || !(v >= 0)) return;
        await aplicar([{ tipo: "upsert", colecao: "fornecedores", id: f.id, dados: { ...f, nome: f.nome.trim(), valorTotal: v || 0 } }], "Fornecedor salvo");
        aoTerminar();
      }}
    >
      <Campo rotulo="Nome do fornecedor">
        <Input value={f.nome} onChange={(e) => set("nome", e.target.value)} required autoFocus={!inicial} placeholder="ex.: Buffet Sabor & Arte" />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Categoria">
          <Select value={f.categoria} onChange={(e) => set("categoria", e.target.value)}>
            {[...new Set([...CATEGORIAS_FORNECEDOR, f.categoria])].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Campo>
        <Campo rotulo="Valor total (R$)">
          <Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
        </Campo>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Quitar até">
          <Input type="date" value={f.vencimento} onChange={(e) => set("vencimento", e.target.value)} />
        </Campo>
        <Campo rotulo="Prioridade">
          <Select value={f.prioridade} onChange={(e) => set("prioridade", Number(e.target.value) as 1 | 2 | 3)}>
            <option value={1}>Alta</option>
            <option value={2}>Média</option>
            <option value={3}>Baixa</option>
          </Select>
        </Campo>
      </div>
      <Campo rotulo="Contato">
        <Input value={f.contato} onChange={(e) => set("contato", e.target.value)} placeholder="telefone, Instagram, e-mail…" />
      </Campo>
      <Campo rotulo="Observação">
        <Textarea rows={2} value={f.observacao} onChange={(e) => set("observacao", e.target.value)} placeholder="ex.: 30% de entrada, resto 10x" />
      </Campo>
      <div className="flex gap-2">
        {inicial && (
          <Botao
            variante="perigo"
            onClick={async () => {
              if (!confirm("Excluir este fornecedor e os pagamentos registrados dele?")) return;
              await aplicar(
                [
                  { tipo: "delete", colecao: "fornecedores", id: inicial.id },
                  ...banco.pagamentosFornecedores.filter((p) => p.fornecedorId === inicial.id).map((p): Op => ({ tipo: "delete", colecao: "pagamentosFornecedores", id: p.id })),
                ],
                "Fornecedor excluído",
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

function FormPagamento({ c, aoTerminar }: { c: FornecedorCalc; aoTerminar: () => void }) {
  const { banco, aplicar } = useDados();
  const [valor, setValor] = useState(c.restante > 0 ? String(c.restante).replace(".", ",") : "");
  const [data, setData] = useState(hojeISO());
  const [obs, setObs] = useState("");
  const [daReserva, setDaReserva] = useState(true);
  const pagamentos = banco.pagamentosFornecedores.filter((p) => p.fornecedorId === c.fornecedor.id).sort((a, b) => a.data.localeCompare(b.data));

  return (
    <div className="space-y-5">
      {pagamentos.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted">Histórico</h3>
          <ul className="divide-y divide-line rounded-xl border border-line text-sm">
            {pagamentos.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span>
                  {dataBR(p.data)} {p.observacao && <span className="text-muted">· {p.observacao}</span>}
                  {p.daReserva === false && <span className="text-xs text-muted"> · fora da reserva</span>}
                </span>
                <span className="flex items-center gap-2">
                  <span className="num font-medium">{dinheiro(p.valor)}</span>
                  <button
                    type="button"
                    className="text-xs text-danger"
                    onClick={async () => confirm("Excluir este pagamento?") && (await aplicar([{ tipo: "delete", colecao: "pagamentosFornecedores", id: p.id }], "Pagamento excluído"))}
                  >
                    excluir
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const v = parseValor(valor);
            if (!(v > 0)) return;
            const pg: PagamentoFornecedor = { id: novoId(), fornecedorId: c.fornecedor.id, data, valor: v, observacao: obs.trim(), daReserva };
            await aplicar([{ tipo: "upsert", colecao: "pagamentosFornecedores", id: pg.id, dados: pg }], "Pagamento registrado 💸");
            aoTerminar();
          }}
        >
          <h3 className="text-xs font-semibold uppercase text-muted">Novo pagamento · falta {dinheiro(c.restante)}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Valor (R$)">
              <Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
            </Campo>
            <Campo rotulo="Data">
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </Campo>
          </div>
          <Campo rotulo="Observação">
            <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="ex.: entrada, parcela 2/5" />
          </Campo>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={daReserva} onChange={(e) => setDaReserva(e.target.checked)} className="mt-0.5 h-5 w-5" />
            <span>
              Saiu da reserva do casamento
              <span className="block text-xs text-muted">Desmarque se foi pago com outro dinheiro (ex.: presente da família) — aí não desconta da reserva.</span>
            </span>
          </label>
          <Botao type="submit" className="w-full">
            Registrar pagamento
          </Botao>
        </form>
    </div>
  );
}

function Importar({ aoTerminar }: { aoTerminar: () => void }) {
  const { aplicar } = useDados();
  const [texto, setTexto] = useState("");
  const previa = lerPlanilha(texto);

  async function confirmar() {
    const ops: Op[] = [];
    for (const p of previa) {
      const id = novoId();
      const f: Fornecedor = { id, nome: p.nome, categoria: p.categoria, contato: p.contato, valorTotal: p.total, vencimento: p.vencimento, prioridade: 2, observacao: "" };
      ops.push({ tipo: "upsert", colecao: "fornecedores", id, dados: f });
      if (p.pago > 0) {
        const pg: PagamentoFornecedor = { id: novoId(), fornecedorId: id, data: hojeISO(), valor: p.pago, observacao: "Já pago (importado da planilha)", daReserva: false };
        ops.push({ tipo: "upsert", colecao: "pagamentosFornecedores", id: pg.id, dados: pg });
      }
    }
    await aplicar(ops, `${previa.length} fornecedor(es) importado(s)`);
    aoTerminar();
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted">
        Copie a tabela da planilha (Excel / Google Sheets) <strong className="text-ink">incluindo a linha de títulos</strong> e cole abaixo. As colunas são
        reconhecidas pelo nome: <strong className="text-ink">Categoria · Fornecedor · Valor Total · Pago</strong> (opcionais: Vencimento, Contato; “Restante” é calculado
        sozinho).
      </p>
      <Textarea rows={7} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={"Categoria\tFornecedor\tValor Total\tPago\tRestante\nDecoração\tGM Flores\tR$4 500,00\tR$1 350,00\tR$3 150,00"} className="font-mono text-xs" />
      <p className="text-xs text-muted">O “valor já pago” entra como pagamento feito fora da reserva (não desconta do que vocês têm guardado hoje).</p>
      {previa.length > 0 && (
        <div className="max-h-56 overflow-auto rounded-xl border border-line">
          <table className="w-full text-xs">
            <thead className="bg-surface-2 text-left">
              <tr>
                <th className="p-2">Nome</th>
                <th className="p-2">Categoria</th>
                <th className="p-2 text-right">Total</th>
                <th className="p-2 text-right">Pago</th>
                <th className="p-2">Até</th>
              </tr>
            </thead>
            <tbody className="num">
              {previa.map((p, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="p-2">{p.nome}</td>
                  <td className="p-2">{p.categoria}</td>
                  <td className="p-2 text-right">{dinheiro(p.total)}</td>
                  <td className="p-2 text-right">{dinheiro(p.pago)}</td>
                  <td className="p-2">{p.vencimento ? dataBR(p.vencimento) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Botao className="w-full" disabled={!previa.length} onClick={confirmar}>
        Importar {previa.length || ""} fornecedor(es)
      </Botao>
    </div>
  );
}
