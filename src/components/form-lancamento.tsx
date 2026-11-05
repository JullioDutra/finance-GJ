"use client";

import { useState } from "react";
import type { Lancamento, PessoaId, TipoLancamento } from "@/lib/types";
import { useDados } from "@/lib/store";
import { hojeISO, parseValor } from "@/lib/format";
import { opNovoLancamento, type Op } from "@/lib/ops";
import { acharCategoria } from "@/lib/whatsapp";
import { Botao, Campo, cx, Input, SeletorPessoa } from "./ui";

const TIPOS: { id: TipoLancamento; nome: string; cor: string }[] = [
  { id: "despesa", nome: "Gasto", cor: "bg-despesa" },
  { id: "receita", nome: "Receita", cor: "bg-receita" },
  { id: "guardado", nome: "Guardar", cor: "bg-guardado" },
];

export function FormLancamento({ editar, aoTerminar, tipoInicial = "despesa" }: { editar?: Lancamento; aoTerminar: () => void; tipoInicial?: TipoLancamento }) {
  const { banco, aplicar } = useDados();
  const [tipo, setTipo] = useState<TipoLancamento>(editar?.tipo ?? tipoInicial);
  const [valor, setValor] = useState(editar ? String(editar.valor).replace(".", ",") : "");
  const [descricao, setDescricao] = useState(editar?.descricao ?? "");
  const [categoriaId, setCategoriaId] = useState(editar?.categoriaId ?? "");
  const [catManual, setCatManual] = useState(!!editar);
  const [data, setData] = useState(editar?.data ?? hojeISO());
  const [pessoa, setPessoa] = useState<PessoaId>(editar?.pessoa ?? "p1");
  const [erro, setErro] = useState("");

  const categorias = banco.categorias.filter((c) => c.tipo === tipo);
  const sugerida = !catManual && descricao ? acharCategoria(banco.categorias, tipo, descricao)?.id : undefined;
  const catEfetiva = categoriaId && categorias.some((c) => c.id === categoriaId) ? categoriaId : sugerida ?? categorias[0]?.id ?? "";

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const v = parseValor(valor);
    if (!(v > 0)) return setErro("Informe um valor válido (ex.: 45,90)");
    if (!catEfetiva) return setErro("Escolha uma categoria");
    const cat = banco.categorias.find((c) => c.id === catEfetiva);
    const op = opNovoLancamento({
      id: editar?.id,
      data,
      tipo,
      valor: v,
      categoriaId: catEfetiva,
      descricao: descricao.trim() || cat?.nome || "",
      pessoa,
      origem: editar?.origem ?? "app",
      contaId: editar?.contaId,
      mes: editar?.mes,
    });
    await aplicar([op], editar ? "Lançamento atualizado" : "Lançamento salvo ✅");
    aoTerminar();
  }

  async function excluir() {
    if (!editar || !confirm("Excluir este lançamento?")) return;
    const ops: Op[] = [{ tipo: "delete", colecao: "lancamentos", id: editar.id }];
    // se veio de uma conta do dia 6, a conta volta a ficar "não paga"
    if (editar.contaId && editar.mes) ops.push({ tipo: "delete", colecao: "pagamentosContas", id: `${editar.contaId}_${editar.mes}` });
    await aplicar(ops, "Lançamento excluído");
    aoTerminar();
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
        {TIPOS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTipo(t.id)}
            className={cx("flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium", tipo === t.id ? "bg-surface shadow-sm" : "text-muted")}
          >
            <span className={cx("h-2.5 w-2.5 rounded-full", t.cor)} />
            {t.nome}
          </button>
        ))}
      </div>

      <Campo rotulo="Valor (R$)">
        <Input inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus={!editar} className="text-2xl font-semibold" />
      </Campo>

      <Campo rotulo="Descrição">
        <Input placeholder={tipo === "despesa" ? "ex.: mercado do mês" : tipo === "receita" ? "ex.: salário" : "ex.: reserva do casamento"} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </Campo>

      <div>
        <span className="mb-1 block text-xs font-medium text-muted">Categoria {sugerida && !catManual && <span className="text-brand">(sugerida pela descrição)</span>}</span>
        <div className="flex flex-wrap gap-1.5">
          {categorias.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setCategoriaId(c.id);
                setCatManual(true);
              }}
              className={cx("rounded-full border px-3 py-1.5 text-sm", catEfetiva === c.id ? "border-brand bg-brand-soft text-brand" : "border-line text-muted hover:text-ink")}
            >
              {c.emoji} {c.nome}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo rotulo="Data">
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        </Campo>
        <div>
          <span className="mb-1 block text-xs font-medium text-muted">De quem</span>
          <SeletorPessoa valor={pessoa} onChange={(v) => setPessoa(v as PessoaId)} />
        </div>
      </div>

      {erro && <p className="text-sm text-danger">{erro}</p>}
      <div className="flex gap-2 pt-1">
        {editar && (
          <Botao variante="perigo" onClick={excluir}>
            Excluir
          </Botao>
        )}
        <Botao type="submit" className="flex-1">
          {editar ? "Salvar alterações" : "Salvar lançamento"}
        </Botao>
      </div>
    </form>
  );
}
