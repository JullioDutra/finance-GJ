"use client";

import { useState } from "react";
import { useDados } from "@/lib/store";
import { lancamentosDoMes } from "@/lib/calc";
import { dataBR, dinheiro, mesAtual, nomeMes, semAcento } from "@/lib/format";
import { Botao, Card, cx, Input, Select, SeletorMes, SeletorPessoa, Titulo, usePessoas, Vazio } from "@/components/ui";
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
        titulo="Lançamentos"
        sub={`${lista.length} lançamento(s) em ${nomeMes(mes)}`}
        acoes={
          <>
            <SeletorMes mes={mes} setMes={setMes} />
            <Botao variante="secundario" onClick={exportarCSV}>
              ⬇️ Excel/CSV
            </Botao>
            <Botao onClick={() => abrir()}>+ Novo</Botao>
          </>
        }
      />

      <Card className="no-print">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="inline-flex rounded-xl border border-line bg-surface p-0.5 text-sm">
            {[
              ["todos", "Todos"],
              ["despesa", "Gastos"],
              ["receita", "Receitas"],
              ["guardado", "Guardado"],
            ].map(([id, n]) => (
              <button key={id} type="button" onClick={() => setTipo(id)} className={cx("rounded-[10px] px-3 py-1.5", tipo === id ? "bg-brand text-brand-ink" : "text-muted")}>
                {n}
              </button>
            ))}
          </div>
          <SeletorPessoa valor={pessoa} onChange={setPessoa} comTodos />
          <Select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="lg:max-w-56">
            <option value="todas">Todas as categorias</option>
            {banco.categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.nome}
              </option>
            ))}
          </Select>
          <Input placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} className="lg:max-w-56" />
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-2xl border border-line bg-surface p-3">
          <div className="text-xs text-muted">Receitas</div>
          <div className="num font-semibold text-receita">{dinheiro(soma("receita"))}</div>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-3">
          <div className="text-xs text-muted">Gastos</div>
          <div className="num font-semibold text-despesa">{dinheiro(soma("despesa"))}</div>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-3">
          <div className="text-xs text-muted">Guardado</div>
          <div className="num font-semibold text-guardado">{dinheiro(soma("guardado"))}</div>
        </div>
      </div>

      {lista.length === 0 ? (
        <Vazio acao={<Botao onClick={() => abrir()}>+ Novo lançamento</Botao>}>Nenhum lançamento encontrado.</Vazio>
      ) : (
        <div className="space-y-3">
          {[...porDia.entries()].map(([dia, itens]) => (
            <Card key={dia} className="p-0">
              <div className="flex items-center justify-between border-b border-line px-4 py-2 text-xs text-muted">
                <span>
                  {dataBR(dia)} · {DIAS[new Date(dia + "T12:00:00").getDay()]}
                </span>
                <span className="num">
                  {dinheiro(itens.filter((l) => l.tipo === "despesa").reduce((s, l) => s + l.valor, 0))} gastos
                </span>
              </div>
              <ul>
                {itens.map((l) => {
                  const c = cats.get(l.categoriaId);
                  return (
                    <li key={l.id}>
                      <button type="button" onClick={() => abrir({ editar: l })} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-lg">{c?.emoji ?? "❔"}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{l.descricao || c?.nome}</span>
                          <span className="block truncate text-xs text-muted">
                            {c?.nome} · {nome(l.pessoa)}
                            {l.origem === "whatsapp" && " · 💬 WhatsApp"}
                            {l.origem === "conta_fixa" && " · ✅ conta do dia 6"}
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
