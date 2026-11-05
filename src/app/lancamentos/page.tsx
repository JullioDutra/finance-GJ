"use client";

import { useState } from "react";
import { useDados } from "@/lib/store";
import { lancamentosDoMes } from "@/lib/calc";
import { dataBR, dinheiro, mesAtual, nomeMes, semAcento } from "@/lib/format";
import { CircleCheckBig, FileSpreadsheet, MessageCircle, Plus, ReceiptText, Search } from "lucide-react";
import { Botao, Card, cx, Input, Segmentos, Select, SeletorMes, SeletorPessoa, Titulo, usePessoas, Vazio } from "@/components/ui";
import { ChipCategoria } from "@/components/icones";
import { useLancamentoModal } from "@/components/shell";

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export default function Lancamentos() {
  const { banco } = useDados();
  const { abrir } = useLancamentoModal();
  const { nome } = usePessoas();
  const [mes, setMes] = useState(mesAtual());
  const [tipo, setTipo] = useState("todos");
  const [pessoa, setPessoa] = useState("todos");
  const [categoria, setCategoria] = useState("todas");
  const [busca, setBusca] = useState("");

  const cats = new Map(banco.categorias.map((c) => [c.id, c]));
  const lista = lancamentosDoMes(banco, mes)
    .filter((l) => tipo === "todos" || l.tipo === tipo)
    .filter((l) => pessoa === "todos" || l.pessoa === pessoa)
    .filter((l) => categoria === "todas" || l.categoriaId === categoria)
    .filter((l) => !busca || semAcento(`${l.descricao} ${cats.get(l.categoriaId)?.nome ?? ""}`).includes(semAcento(busca)))
    .sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm));

  const soma = (t: string) => lista.filter((l) => l.tipo === t).reduce((s, l) => s + l.valor, 0);
  const porDia = new Map<string, typeof lista>();
  for (const l of lista) porDia.set(l.data, [...(porDia.get(l.data) ?? []), l]);

  function exportarCSV() {
    const linhas = [
      ["Data", "Tipo", "Categoria", "Descrição", "Pessoa", "Valor", "Origem"],
      ...lista.map((l) => [dataBR(l.data), l.tipo, cats.get(l.categoriaId)?.nome ?? "", l.descricao, nome(l.pessoa), l.valor.toFixed(2).replace(".", ","), l.origem]),
    ];
    const csv = "﻿" + linhas.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `lancamentos-${mes}.csv`;
    a.click();
  }

  return (
    <div className="space-y-4">
      <Titulo
        area="Finanças"
        titulo="Lançamentos"
        sub={`${lista.length} lançamento(s) em ${nomeMes(mes)}`}
        acoes={
          <>
            <SeletorMes mes={mes} setMes={setMes} />
            <Botao variante="secundario" icone={FileSpreadsheet} onClick={exportarCSV}>
              Excel
            </Botao>
            <Botao icone={Plus} onClick={() => abrir()}>
              Novo
            </Botao>
          </>
        }
      />

      <Card className="no-print">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Segmentos
            valor={tipo}
            onChange={setTipo}
            opcoes={[
              { id: "todos", nome: "Todos" },
              { id: "despesa", nome: "Gastos" },
              { id: "receita", nome: "Receitas" },
              { id: "guardado", nome: "Guardado" },
            ]}
          />
          <SeletorPessoa valor={pessoa} onChange={setPessoa} comTodos />
          <Select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="lg:max-w-56">
            <option value="todas">Todas as categorias</option>
            {banco.categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
          <div className="relative lg:max-w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input placeholder="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 divide-x divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-cartao">
        {[
          ["Receitas", soma("receita"), "text-receita"],
          ["Gastos", soma("despesa"), "text-despesa"],
          ["Guardado", soma("guardado"), "text-guardado"],
        ].map(([n, v, c]) => (
          <div key={n as string} className="px-3 py-3.5 text-center">
            <div className="text-xs text-muted">{n}</div>
            <div className={cx("num mt-0.5 font-semibold", c as string)}>{dinheiro(v as number)}</div>
          </div>
        ))}
      </div>

      {lista.length === 0 ? (
        <Vazio
          icone={ReceiptText}
          acao={
            <Botao icone={Plus} onClick={() => abrir()}>
              Novo lançamento
            </Botao>
          }
        >
          Nenhum lançamento encontrado.
        </Vazio>
      ) : (
        <div className="space-y-3">
          {[...porDia.entries()].map(([dia, itens]) => (
            <Card key={dia} className="overflow-hidden p-0 sm:p-0">
              <div className="flex items-center justify-between border-b border-line bg-surface-2/50 px-4 py-2 text-xs text-muted">
                <span className="font-medium">
                  {dataBR(dia)} <span className="font-normal">· {DIAS[new Date(dia + "T12:00:00").getDay()]}</span>
                </span>
                <span className="num">
                  {dinheiro(itens.filter((l) => l.tipo === "despesa").reduce((s, l) => s + l.valor, 0))} gastos
                </span>
              </div>
              <ul className="divide-y divide-line">
                {itens.map((l) => {
                  const c = cats.get(l.categoriaId);
                  return (
                    <li key={l.id}>
                      <button type="button" onClick={() => abrir({ editar: l })} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-2/60">
                        <ChipCategoria categoria={c} tom={l.tipo} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{l.descricao || c?.nome}</span>
                          <span className="flex items-center gap-1 truncate text-xs text-muted">
                            {c?.nome} · {nome(l.pessoa)}
                            {l.origem === "whatsapp" && (
                              <>
                                {" · "}
                                <MessageCircle className="h-3 w-3" /> WhatsApp
                              </>
                            )}
                            {l.origem === "conta_fixa" && (
                              <>
                                {" · "}
                                <CircleCheckBig className="h-3 w-3" /> conta do dia 6
                              </>
                            )}
                          </span>
                        </span>
                        <span className={cx("num shrink-0 text-sm font-semibold", l.tipo === "receita" ? "text-receita" : l.tipo === "guardado" ? "text-guardado" : "")}>
                          {l.tipo === "despesa" ? "−" : "+"} {dinheiro(l.valor)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
