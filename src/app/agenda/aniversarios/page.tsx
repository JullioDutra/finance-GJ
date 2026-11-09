"use client";

import { useState } from "react";
import { Cake, Gift, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useDados } from "@/lib/store";
import { hojeISO, novoId, semAcento } from "@/lib/format";
import { rotuloDia } from "@/lib/agenda";
import { lerDataAniversario, proximosAniversarios, RELACOES } from "@/lib/aniversarios";
import type { Aniversario } from "@/lib/types";
import { Botao, Campo, Card, cx, Input, Modal, Select, Titulo, Vazio } from "@/components/ui";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const dataBR = (md: string) => `${md.slice(3)}/${md.slice(0, 2)}`;

export default function Aniversarios() {
  const { banco, aplicar } = useDados();
  const hoje = hojeISO();
  const [editar, setEditar] = useState<Aniversario | "novo" | null>(null);
  const [busca, setBusca] = useState("");
  const [relacao, setRelacao] = useState("todas");

  const todos = proximosAniversarios(banco, hoje)
    .filter((p) => relacao === "todas" || p.aniversario.relacao === relacao)
    .filter((p) => !busca.trim() || semAcento(p.aniversario.nome).includes(semAcento(busca.trim())));
  const hojeLista = todos.filter((p) => p.dias === 0);
  const emBreve = todos.filter((p) => p.dias > 0 && p.dias <= 30);
  const depois = todos.filter((p) => p.dias > 30);
  const relacoesUsadas = [...new Set((banco.aniversarios ?? []).map((a) => a.relacao).filter(Boolean))];

  const remover = (a: Aniversario) => {
    if (confirm(`Apagar o aniversário de ${a.nome}?`)) aplicar([{ tipo: "delete", colecao: "aniversarios", id: a.id }], "Aniversário apagado");
  };

  const Linha = ({ p }: { p: (typeof todos)[number] }) => {
    const d = new Date(p.data + "T12:00:00");
    return (
      <li className="flex items-center gap-3 py-2.5">
        <div className={cx("grid h-12 w-12 shrink-0 place-items-center rounded-xl text-center leading-none", p.dias === 0 ? "bg-guardado text-white" : "bg-guardado/12 text-guardado")}>
          <div>
            <div className="display text-lg font-medium">{p.data.slice(8)}</div>
            <div className="text-[10px] uppercase tracking-wider">{MESES[d.getMonth()]}</div>
          </div>
        </div>
        <button type="button" onClick={() => setEditar(p.aniversario)} className="min-w-0 flex-1 text-left">
          <div className="truncate font-medium">{p.aniversario.nome}</div>
          <div className="truncate text-xs text-muted">
            {[p.dias === 0 ? "hoje!" : p.dias === 1 ? "amanhã" : `${rotuloDia(p.data, hoje)} · em ${p.dias} dias`, p.idade ? `faz ${p.idade} anos` : "", p.aniversario.relacao].filter(Boolean).join(" · ")}
          </div>
        </button>
        <button type="button" onClick={() => setEditar(p.aniversario)} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Editar">
          <Pencil className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => remover(p.aniversario)} className="rounded-lg p-2 text-muted hover:bg-danger-soft hover:text-danger" aria-label="Apagar">
          <Trash2 className="h-4 w-4" />
        </button>
      </li>
    );
  };

  return (
    <div className="space-y-5">
      <Titulo
        area="Agenda"
        titulo="Aniversários"
        sub="Todo dia às 7h o robô avisa no grupo quem faz aniversário"
        acoes={
          <Botao icone={Plus} onClick={() => setEditar("novo")}>
            Novo aniversário
          </Botao>
        }
      />

      {(banco.aniversarios ?? []).length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar pelo nome" className="pl-10" />
          </div>
          <Select value={relacao} onChange={(e) => setRelacao(e.target.value)}>
            <option value="todas">Todas as relações</option>
            {[...new Set([...RELACOES, ...relacoesUsadas])].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </div>
      )}

      {!(banco.aniversarios ?? []).length ? (
        <Vazio
          icone={Cake}
          acao={
            <Botao icone={Plus} onClick={() => setEditar("novo")}>
              Cadastrar o primeiro
            </Botao>
          }
        >
          Nenhum aniversário ainda. Cadastre aqui ou mande no grupo: <b>aniversário tia Ana 15/03</b>
        </Vazio>
      ) : (
        <>
          {hojeLista.length > 0 && (
            <Card titulo="Hoje" icone={Gift} className="border-guardado/40 bg-guardado/5">
              <ul className="divide-y divide-line">
                {hojeLista.map((p) => (
                  <Linha key={p.aniversario.id} p={p} />
                ))}
              </ul>
            </Card>
          )}
          <Card titulo="Próximos 30 dias" icone={Cake} acao={<span className="text-xs text-muted">{emBreve.length}</span>}>
            {emBreve.length ? (
              <ul className="divide-y divide-line">
                {emBreve.map((p) => (
                  <Linha key={p.aniversario.id} p={p} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nenhum aniversário nos próximos 30 dias.</p>
            )}
          </Card>
          {depois.length > 0 && (
            <Card titulo="Depois" icone={Cake} acao={<span className="text-xs text-muted">{depois.length}</span>}>
              <ul className="divide-y divide-line">
                {depois.map((p) => (
                  <Linha key={p.aniversario.id} p={p} />
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      <Card titulo="Pelo WhatsApp" icone={Cake}>
        <ul className="space-y-1.5 text-sm text-muted">
          <li>
            <b className="text-ink">aniversário tia Ana 15/03</b> cadastra (com o ano, 15/03/1970, mostra a idade)
          </li>
          <li>
            <b className="text-ink">aniversários</b> mostra os próximos · <b className="text-ink">apagar aniversário Ana</b> remove
          </li>
          <li>
            Vários de uma vez: <b className="text-ink">aniversários</b> e uma pessoa por linha (<i>Ana 15/03</i>)
          </li>
        </ul>
      </Card>

      <Modal aberto={editar !== null} aoFechar={() => setEditar(null)} titulo={editar === "novo" ? "Novo aniversário" : "Editar aniversário"}>
        {editar !== null && <FormAniversario key={editar === "novo" ? "novo" : editar.id} inicial={editar === "novo" ? undefined : editar} aoTerminar={() => setEditar(null)} />}
      </Modal>
    </div>
  );
}

function FormAniversario({ inicial, aoTerminar }: { inicial?: Aniversario; aoTerminar: () => void }) {
  const { aplicar } = useDados();
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [data, setData] = useState(inicial ? `${dataBR(inicial.data)}${inicial.ano ? `/${inicial.ano}` : ""}` : "");
  const [relacao, setRelacao] = useState(inicial?.relacao ?? "Família");
  const [observacao, setObservacao] = useState(inicial?.observacao ?? "");
  const [erro, setErro] = useState("");

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const d = lerDataAniversario(data);
    if (!nome.trim()) return setErro("Coloque o nome.");
    if (!d) return setErro("Data inválida. Use dia/mês (15/03) ou dia/mês/ano (15/03/1990).");
    const a: Aniversario = { id: inicial?.id ?? novoId(), nome: nome.trim(), data: d.data, ...(d.ano ? { ano: d.ano } : {}), relacao, observacao: observacao.trim() };
    await aplicar([{ tipo: "upsert", colecao: "aniversarios", id: a.id, dados: a }], inicial ? "Aniversário atualizado" : "Aniversário salvo");
    aoTerminar();
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <Campo rotulo="Nome">
        <Input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Tia Ana" />
      </Campo>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo rotulo="Data" dica="dia/mês, ou dia/mês/ano para mostrar a idade">
          <Input value={data} onChange={(e) => setData(e.target.value)} placeholder="15/03 ou 15/03/1990" inputMode="numeric" />
        </Campo>
        <Campo rotulo="Relação">
          <Select value={relacao} onChange={(e) => setRelacao(e.target.value)}>
            {[...new Set([...RELACOES, relacao])].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Campo>
      </div>
      <Campo rotulo="Observação (opcional)">
        <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: gosta de chocolate" />
      </Campo>
      {erro && <p className="text-sm text-danger">{erro}</p>}
      <div className="flex justify-end gap-2">
        <Botao variante="secundario" onClick={aoTerminar}>
          Cancelar
        </Botao>
        <Botao type="submit">Salvar</Botao>
      </div>
    </form>
  );
}
