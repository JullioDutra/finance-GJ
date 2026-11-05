"use client";

import { useEffect, useState } from "react";
import { useDados } from "@/lib/store";
import { hojeISO, novoId, parseValor } from "@/lib/format";
import { processarMensagem, AJUDA_WHATSAPP } from "@/lib/whatsapp";
import type { Op } from "@/lib/ops";
import type { Banco, Categoria, Configuracoes, PessoaId, TipoLancamento } from "@/lib/types";
import { COLECOES } from "@/lib/types";
import { Botao, Campo, Card, cx, Input, Modal, Select, SeletorPessoa, Selo, Titulo } from "@/components/ui";

export default function Ajustes() {
  return (
    <div className="space-y-4">
      <Titulo titulo="Ajustes" sub="Dados do casal, categorias, WhatsApp, instalação e backup" />
      <Status />
      <ConfigCasal />
      <WhatsApp />
      <Categorias />
      <Instalar />
      <Backup />
    </div>
  );
}

function Status() {
  const { modo } = useDados();
  return (
    <Card titulo="Onde os dados ficam salvos">
      {modo === "nuvem" ? (
        <p className="text-sm">
          <Selo tom="ok">☁️ Nuvem (Supabase)</Selo> — vocês dois veem os mesmos dados em qualquer aparelho, e o WhatsApp lança direto aqui.
        </p>
      ) : (
        <div className="space-y-2 text-sm">
          <p>
            <Selo tom="warn">📱 Modo local</Selo> — os dados estão salvos só neste navegador. Para sincronizar entre vocês dois e receber mensagens do WhatsApp, configure o banco:
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-muted">
            <li>Crie um projeto grátis em supabase.com.</li>
            <li>No SQL Editor, rode o arquivo <code>supabase/schema.sql</code> do projeto.</li>
            <li>
              Na Vercel, cadastre <code>SUPABASE_URL</code>, <code>SUPABASE_SERVICE_ROLE_KEY</code>, <code>APP_PIN</code> e <code>APP_SECRET</code>.
            </li>
            <li>Antes de trocar, use “Exportar backup” aqui embaixo e depois “Importar backup” já na nuvem para levar o que lançaram.</li>
          </ol>
        </div>
      )}
    </Card>
  );
}

function ConfigCasal() {
  const { banco, aplicar } = useDados();
  const [c, setC] = useState<Configuracoes>(banco.config);
  const [num, setNum] = useState({
    orcamentoCasamento: String(banco.config.orcamentoCasamento || ""),
    reservaInicial: String(banco.config.reservaInicial || ""),
    metaMensalGuardar: String(banco.config.metaMensalGuardar || ""),
  });
  const set = <K extends keyof Configuracoes>(k: K, v: Configuracoes[K]) => setC((x) => ({ ...x, [k]: v }));
  const n = (s: string) => {
    const v = parseValor(s);
    return Number.isFinite(v) ? v : 0;
  };

  return (
    <Card titulo="Casal e casamento">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const nova: Configuracoes = {
            ...c,
            orcamentoCasamento: n(num.orcamentoCasamento),
            reservaInicial: n(num.reservaInicial),
            metaMensalGuardar: n(num.metaMensalGuardar),
            diaPadraoContas: Math.min(31, Math.max(1, Number(c.diaPadraoContas) || 6)),
          };
          await aplicar([{ tipo: "upsert", colecao: "config", id: "config", dados: nova }], "Ajustes salvos");
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Nome 1">
            <Input value={c.nomeP1} onChange={(e) => set("nomeP1", e.target.value)} />
          </Campo>
          <Campo rotulo="Nome 2">
            <Input value={c.nomeP2} onChange={(e) => set("nomeP2", e.target.value)} />
          </Campo>
          <Campo rotulo={`WhatsApp de ${c.nomeP1}`} dica="Com DDD. Usado para saber quem mandou a mensagem.">
            <Input inputMode="tel" value={c.telefoneP1} onChange={(e) => set("telefoneP1", e.target.value)} placeholder="(11) 99999-9999" />
          </Campo>
          <Campo rotulo={`WhatsApp de ${c.nomeP2}`}>
            <Input inputMode="tel" value={c.telefoneP2} onChange={(e) => set("telefoneP2", e.target.value)} placeholder="(11) 98888-8888" />
          </Campo>
          <Campo rotulo="Data do casamento">
            <Input type="date" value={c.dataCasamento} onChange={(e) => set("dataCasamento", e.target.value)} />
          </Campo>
          <Campo rotulo="Dia das contas fixas" dica="Dia padrão para novas contas (vocês usam o dia 6).">
            <Input type="number" min={1} max={31} value={c.diaPadraoContas} onChange={(e) => set("diaPadraoContas", Number(e.target.value))} />
          </Campo>
          <Campo rotulo="Orçamento total do casamento (R$)" dica="Opcional. Se vazio, usa a soma dos fornecedores.">
            <Input inputMode="decimal" value={num.orcamentoCasamento} onChange={(e) => setNum({ ...num, orcamentoCasamento: e.target.value })} placeholder="0,00" />
          </Campo>
          <Campo rotulo="Já tinham guardado antes de usar o app (R$)" dica="Valor que já existe hoje na reserva do casamento.">
            <Input inputMode="decimal" value={num.reservaInicial} onChange={(e) => setNum({ ...num, reservaInicial: e.target.value })} placeholder="0,00" />
          </Campo>
          <Campo rotulo="Meta de quanto guardar por mês (R$)" dica="Usada na projeção. Se vazio, usa a média dos últimos 3 meses.">
            <Input inputMode="decimal" value={num.metaMensalGuardar} onChange={(e) => setNum({ ...num, metaMensalGuardar: e.target.value })} placeholder="0,00" />
          </Campo>
        </div>
        <Botao type="submit">Salvar ajustes</Botao>
      </form>
    </Card>
  );
}

function WhatsApp() {
  const { banco, aplicar, modo } = useDados();
  const [origem] = useState(() => (typeof window !== "undefined" ? window.location.origin : ""));
  const [texto, setTexto] = useState("");
  const [pessoa, setPessoa] = useState<PessoaId>("p1");
  const [resposta, setResposta] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    const r = processarMensagem(banco, texto, pessoa, hojeISO());
    setResposta(r.resposta);
    if (r.ops.length) await aplicar(r.ops, "Lançado pelo simulador");
    setTexto("");
  }

  return (
    <Card titulo="💬 WhatsApp">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2 text-sm">
          <p>Mandem mensagens como estas para o número conectado e o lançamento cai direto no sistema:</p>
          <pre className="whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-xs">{AJUDA_WHATSAPP.replace(/\*/g, "").replace(/`/g, "")}</pre>
          <p className="text-muted">
            Endereço do webhook para configurar no provedor (Meta Cloud API, Z-API, Evolution, Twilio, n8n…):
          </p>
          <code className="block break-all rounded-xl bg-surface-2 p-2 text-xs">{origem}/api/whatsapp?token=SEU_WHATSAPP_WEBHOOK_TOKEN</code>
          {modo !== "nuvem" && <p className="text-xs text-warn">⚠️ O WhatsApp só funciona com o banco na nuvem (Supabase) configurado.</p>}
        </div>
        <form onSubmit={enviar} className="space-y-2">
          <div className="text-xs font-medium text-muted">Simulador — teste (e lance de verdade) como se fosse pelo WhatsApp</div>
          <SeletorPessoa valor={pessoa} onChange={(v) => setPessoa(v as PessoaId)} />
          <div className="flex gap-2">
            <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="ex.: mercado 154,90" />
            <Botao type="submit">Enviar</Botao>
          </div>
          {resposta && <pre className="whitespace-pre-wrap rounded-xl bg-ok-soft p-3 text-xs text-ink">{resposta.replace(/\*/g, "")}</pre>}
        </form>
      </div>
    </Card>
  );
}

const TIPOS: { id: TipoLancamento; nome: string }[] = [
  { id: "despesa", nome: "Gasto" },
  { id: "receita", nome: "Receita" },
  { id: "guardado", nome: "Guardar" },
];

function Categorias() {
  const { banco } = useDados();
  const [editar, setEditar] = useState<Categoria | "nova" | null>(null);
  return (
    <Card titulo="Categorias" acao={<Botao pequeno onClick={() => setEditar("nova")}>+ Categoria</Botao>}>
      <p className="mb-3 text-xs text-muted">
        🏠 = entra no “custo da casa”. As palavras-chave ajudam o WhatsApp a escolher a categoria certa (ex.: “uber” → Transporte).
      </p>
      {TIPOS.map((t) => (
        <div key={t.id} className="mb-3">
          <div className="mb-1 text-xs font-semibold uppercase text-muted">{t.nome}</div>
          <div className="flex flex-wrap gap-1.5">
            {banco.categorias
              .filter((c) => c.tipo === t.id)
              .map((c) => (
                <button key={c.id} type="button" onClick={() => setEditar(c)} className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-brand">
                  {c.emoji} {c.nome} {c.casa && "🏠"}
                </button>
              ))}
          </div>
        </div>
      ))}
      <Modal aberto={editar !== null} aoFechar={() => setEditar(null)} titulo={editar === "nova" ? "Nova categoria" : "Editar categoria"}>
        {editar && <FormCategoria c={editar === "nova" ? undefined : editar} aoTerminar={() => setEditar(null)} />}
      </Modal>
    </Card>
  );
}

function FormCategoria({ c: inicial, aoTerminar }: { c?: Categoria; aoTerminar: () => void }) {
  const { banco, aplicar } = useDados();
  const [c, setC] = useState<Categoria>(inicial ?? { id: novoId(), nome: "", tipo: "despesa", emoji: "📦", casa: false, palavras: "" });
  const set = <K extends keyof Categoria>(k: K, v: Categoria[K]) => setC((x) => ({ ...x, [k]: v }));
  const emUso = inicial ? banco.lancamentos.some((l) => l.categoriaId === inicial.id) || banco.contas.some((x) => x.categoriaId === inicial.id) : false;
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!c.nome.trim()) return;
        await aplicar([{ tipo: "upsert", colecao: "categorias", id: c.id, dados: { ...c, nome: c.nome.trim() } }], "Categoria salva");
        aoTerminar();
      }}
    >
      <div className="grid grid-cols-[5rem_1fr] gap-3">
        <Campo rotulo="Emoji">
          <Input value={c.emoji} onChange={(e) => set("emoji", e.target.value)} className="text-center" />
        </Campo>
        <Campo rotulo="Nome">
          <Input value={c.nome} onChange={(e) => set("nome", e.target.value)} required autoFocus={!inicial} />
        </Campo>
      </div>
      <Campo rotulo="Tipo">
        <Select value={c.tipo} onChange={(e) => set("tipo", e.target.value as TipoLancamento)}>
          {TIPOS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </Select>
      </Campo>
      <Campo rotulo="Palavras-chave (separadas por vírgula)" dica="Usadas para reconhecer mensagens do WhatsApp e sugerir a categoria.">
        <Input value={c.palavras} onChange={(e) => set("palavras", e.target.value)} placeholder="ex.: uber,gasolina,99" />
      </Campo>
      {c.tipo === "despesa" && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={c.casa} onChange={(e) => set("casa", e.target.checked)} className="h-5 w-5" />
          🏠 Faz parte do custo da casa
        </label>
      )}
      <div className="flex gap-2">
        {inicial && (
          <Botao
            variante="perigo"
            disabled={emUso}
            title={emUso ? "Categoria em uso por lançamentos ou contas" : ""}
            onClick={async () => {
              if (!confirm("Excluir esta categoria?")) return;
              await aplicar([{ tipo: "delete", colecao: "categorias", id: inicial.id }], "Categoria excluída");
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
      {emUso && <p className="text-xs text-muted">Esta categoria está em uso, por isso não pode ser excluída (mas pode ser renomeada).</p>}
    </form>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

function Instalar() {
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null);
  const [instalado] = useState(() => typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches);
  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setEvento(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  return (
    <Card titulo="📲 Instalar no celular">
      {instalado ? (
        <p className="text-sm text-ok">✅ O app já está instalado neste aparelho.</p>
      ) : (
        <div className="space-y-2 text-sm">
          {evento && <Botao onClick={() => evento.prompt()}>Instalar agora</Botao>}
          <p>
            <strong>iPhone (Safari):</strong> toque em <span className="rounded bg-surface-2 px-1">Compartilhar ⬆️</span> → <strong>Adicionar à Tela de Início</strong>.
          </p>
          <p>
            <strong>Android (Chrome):</strong> menu <span className="rounded bg-surface-2 px-1">⋮</span> → <strong>Instalar app</strong> (ou “Adicionar à tela inicial”).
          </p>
        </div>
      )}
    </Card>
  );
}

function Backup() {
  const { banco, aplicar, modo } = useDados();
  const [msg, setMsg] = useState("");

  function exportar() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(banco, null, 2)], { type: "application/json" }));
    a.download = `backup-financas-gj-${hojeISO()}.json`;
    a.click();
  }

  async function importar(arquivo: File) {
    try {
      const b = JSON.parse(await arquivo.text()) as Banco;
      if (!b || !Array.isArray(b.lancamentos)) throw new Error("Arquivo inválido");
      if (!confirm("Importar este backup? Os registros do arquivo serão adicionados/atualizados aqui.")) return;
      const ops: Op[] = [];
      for (const col of COLECOES) {
        if (col === "config") {
          if (b.config) ops.push({ tipo: "upsert", colecao: "config", id: "config", dados: b.config });
          continue;
        }
        for (const r of (b[col] as { id: string }[] | undefined) ?? []) ops.push({ tipo: "upsert", colecao: col, id: r.id, dados: r });
      }
      await aplicar(ops, `Backup importado (${ops.length} registros)`);
      setMsg("");
    } catch (e) {
      setMsg(`Erro: ${(e as Error).message}`);
    }
  }

  return (
    <Card titulo="💾 Backup e conta">
      <div className="flex flex-wrap gap-2">
        <Botao variante="secundario" onClick={exportar}>
          ⬇️ Exportar backup
        </Botao>
        <label className={cx("inline-flex cursor-pointer items-center rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium hover:bg-surface-2")}>
          ⬆️ Importar backup
          <input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])} />
        </label>
        {modo === "nuvem" && (
          <Botao
            variante="fantasma"
            onClick={async () => {
              await fetch("/api/login", { method: "DELETE" });
              window.location.href = "/login";
            }}
          >
            Sair
          </Botao>
        )}
      </div>
      {msg && <p className="mt-2 text-sm text-danger">{msg}</p>}
    </Card>
  );
}
