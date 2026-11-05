"use client";

import { useState } from "react";
import { useDados } from "@/lib/store";
import { dataCurta, hojeISO, novoId } from "@/lib/format";
import { GRUPOS_TAREFAS } from "@/lib/defaults";
import type { PessoaId, Tarefa } from "@/lib/types";
import { Check, CircleAlert, ListChecks, Plus, Printer, Trash2 } from "lucide-react";
import { Barra, Botao, Campo, Card, cx, Input, Modal, Segmentos, Select, SeletorPessoa, Selo, Textarea, Titulo, usePessoas, Vazio } from "@/components/ui";

export default function Organizacao() {
  const { banco, aplicar } = useDados();
  const { nome } = usePessoas();
  const [filtro, setFiltro] = useState<"pendentes" | "todas" | "feitas">("pendentes");
  const [quem, setQuem] = useState("todos");
  const [editar, setEditar] = useState<Tarefa | "nova" | null>(null);
  const [rapida, setRapida] = useState("");
  const hoje = hojeISO();

  const todas = banco.tarefas;
  const feitas = todas.filter((t) => t.feita).length;
  const atrasadas = todas.filter((t) => !t.feita && t.prazo && t.prazo < hoje).length;
  const lista = todas
    .filter((t) => (filtro === "todas" ? true : filtro === "feitas" ? t.feita : !t.feita))
    .filter((t) => quem === "todos" || t.responsavel === quem)
    .sort((a, b) => Number(a.feita) - Number(b.feita) || (a.prazo || "9999").localeCompare(b.prazo || "9999") || a.titulo.localeCompare(b.titulo));

  const grupos = [...new Set([...GRUPOS_TAREFAS, ...todas.map((t) => t.grupo)])].filter((g) => lista.some((t) => t.grupo === g));

  async function alternar(t: Tarefa) {
    await aplicar([{ tipo: "upsert", colecao: "tarefas", id: t.id, dados: { ...t, feita: !t.feita } }], t.feita ? "Tarefa reaberta" : "Tarefa concluída");
  }

  async function adicionarRapida(e: React.FormEvent) {
    e.preventDefault();
    if (!rapida.trim()) return;
    const t: Tarefa = { id: novoId(), titulo: rapida.trim(), grupo: "Outros", responsavel: "casal", prazo: "", feita: false, observacao: "" };
    await aplicar([{ tipo: "upsert", colecao: "tarefas", id: t.id, dados: t }], "Tarefa adicionada");
    setRapida("");
  }

  return (
    <div className="space-y-4">
      <Titulo
        area="Casamento"
        titulo="Organização"
        sub="Checklist de tudo que precisa ser feito"
        acoes={
          <>
            <Botao variante="secundario" icone={Printer} onClick={() => window.print()} aria-label="Imprimir" />
            <Botao icone={Plus} onClick={() => setEditar("nova")}>
              Tarefa
            </Botao>
          </>
        }
      />

      <section className="avoid-break rounded-3xl border border-line bg-surface p-5 shadow-cartao sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="rotulo">Progresso</div>
            <div className="display mt-1 flex items-baseline gap-2">
              <span className="num text-4xl font-medium">{feitas}</span>
              <span className="text-lg text-muted">de {todas.length} tarefas</span>
            </div>
          </div>
          {atrasadas > 0 && (
            <Selo tom="danger" icone={CircleAlert}>
              {atrasadas} atrasada(s)
            </Selo>
          )}
        </div>
        <div className="mt-4">
          <Barra valor={feitas} total={todas.length} cor="bg-ok" altura="h-2.5" />
        </div>
      </section>

      <div className="no-print flex flex-wrap gap-2">
        <Segmentos
          valor={filtro}
          onChange={setFiltro}
          opcoes={[
            { id: "pendentes", nome: "Pendentes" },
            { id: "todas", nome: "Todas" },
            { id: "feitas", nome: "Feitas" },
          ]}
        />
        <SeletorPessoa valor={quem} onChange={setQuem} comTodos />
      </div>

      <form onSubmit={adicionarRapida} className="no-print flex gap-2">
        <Input value={rapida} onChange={(e) => setRapida(e.target.value)} placeholder="Adicionar tarefa rápida (ex.: comprar sapato)" />
        <Botao type="submit" variante="secundario" icone={Plus}>
          Adicionar
        </Botao>
      </form>

      {lista.length === 0 ? (
        <Vazio icone={ListChecks}>{filtro === "pendentes" ? "Nenhuma tarefa pendente." : "Nenhuma tarefa aqui."}</Vazio>
      ) : (
        grupos.map((g) => {
          const itens = lista.filter((t) => t.grupo === g);
          const totalGrupo = todas.filter((t) => t.grupo === g);
          return (
            <Card
              key={g}
              titulo={g}
              acao={
                <span className="num text-xs text-muted">
                  {totalGrupo.filter((t) => t.feita).length}/{totalGrupo.length}
                </span>
              }
              className="overflow-hidden p-0 pt-4 sm:p-0 sm:pt-5 [&>div:first-child]:px-4 sm:[&>div:first-child]:px-5"
            >
              <ul className="divide-y divide-line">
                {itens.map((t) => {
                  const atrasada = !t.feita && t.prazo && t.prazo < hoje;
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                      <button
                        type="button"
                        onClick={() => alternar(t)}
                        aria-label={t.feita ? "Reabrir tarefa" : "Concluir tarefa"}
                        className={cx(
                          "grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition active:scale-90",
                          t.feita ? "border-ok bg-ok text-white" : "border-surface-3 hover:border-ok",
                        )}
                      >
                        {t.feita && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                      </button>
                      <button type="button" onClick={() => setEditar(t)} className="min-w-0 flex-1 text-left">
                        <span className={cx("block text-sm", t.feita && "text-muted line-through")}>{t.titulo}</span>
                        <span className="block text-xs text-muted">
                          {nome(t.responsavel)}
                          {t.observacao && ` · ${t.observacao}`}
                        </span>
                      </button>
                      {t.prazo && <span className={cx("shrink-0 text-xs", atrasada ? "font-semibold text-danger" : "text-muted")}>{dataCurta(t.prazo)}</span>}
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })
      )}

      <Modal aberto={editar !== null} aoFechar={() => setEditar(null)} titulo={editar === "nova" ? "Nova tarefa" : "Editar tarefa"}>
        {editar && <FormTarefa t={editar === "nova" ? undefined : editar} aoTerminar={() => setEditar(null)} />}
      </Modal>
    </div>
  );
}

function FormTarefa({ t: inicial, aoTerminar }: { t?: Tarefa; aoTerminar: () => void }) {
  const { aplicar } = useDados();
  const [t, setT] = useState<Tarefa>(inicial ?? { id: novoId(), titulo: "", grupo: "Planejamento", responsavel: "casal", prazo: "", feita: false, observacao: "" });
  const set = <K extends keyof Tarefa>(k: K, v: Tarefa[K]) => setT((x) => ({ ...x, [k]: v }));
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!t.titulo.trim()) return;
        await aplicar([{ tipo: "upsert", colecao: "tarefas", id: t.id, dados: { ...t, titulo: t.titulo.trim() } }], "Tarefa salva");
        aoTerminar();
      }}
    >
      <Campo rotulo="Tarefa">
        <Input value={t.titulo} onChange={(e) => set("titulo", e.target.value)} required autoFocus={!inicial} />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Grupo">
          <Select value={t.grupo} onChange={(e) => set("grupo", e.target.value)}>
            {[...new Set([...GRUPOS_TAREFAS, t.grupo])].map((g) => (
              <option key={g}>{g}</option>
            ))}
          </Select>
        </Campo>
        <Campo rotulo="Prazo">
          <Input type="date" value={t.prazo} onChange={(e) => set("prazo", e.target.value)} />
        </Campo>
      </div>
      <div>
        <span className="mb-1 block text-xs font-medium text-muted">Responsável</span>
        <SeletorPessoa valor={t.responsavel} onChange={(v) => set("responsavel", v as PessoaId)} />
      </div>
      <Campo rotulo="Observação">
        <Textarea rows={2} value={t.observacao} onChange={(e) => set("observacao", e.target.value)} />
      </Campo>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={t.feita} onChange={(e) => set("feita", e.target.checked)} className="h-5 w-5" />
        Concluída
      </label>
      <div className="flex gap-2">
        {inicial && (
          <Botao
            variante="perigo"
            icone={Trash2}
            onClick={async () => {
              if (!confirm("Excluir esta tarefa?")) return;
              await aplicar([{ tipo: "delete", colecao: "tarefas", id: inicial.id }], "Tarefa excluída");
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
