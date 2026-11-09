"use client";

import { useEffect, useState } from "react";
import { useDados } from "@/lib/store";
import { hojeISO, novoId, parseValor } from "@/lib/format";
import { processarMensagem, AJUDA_WHATSAPP } from "@/lib/whatsapp";
import type { Op } from "@/lib/ops";
import type { Banco, Categoria, Configuracoes, PessoaId, TipoLancamento } from "@/lib/types";
import { COLECOES } from "@/lib/types";
import {
  Check,
  Cloud,
  Database,
  Download,
  Fingerprint,
  HardDrive,
  House,
  LogOut,
  MessageCircle,
  Plus,
  Smartphone,
  Tags,
  Trash2,
  ShieldQuestion,
  Upload,
  UserCheck,
  UsersRound,
  X,
} from "lucide-react";
import { Botao, Campo, Card, cx, Input, Modal, Select, SeletorPessoa, Selo, Titulo } from "@/components/ui";
import { ChipCategoria, ICONES_CATEGORIA, iconeDaCategoria } from "@/components/icones";
import { cadastrarDigital, digitalDisponivel } from "@/lib/passkey-cliente";
import { dataBR } from "@/lib/format";

export default function Ajustes() {
  return (
    <div className="space-y-5">
      <Titulo titulo="Ajustes" sub="Dados do casal, acesso, categorias, instalação e backup" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Status />
        <Acesso />
      </div>
      <ConfigCasal />
      <WhatsApp />
      <Categorias />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Instalar />
        <Backup />
      </div>
    </div>
  );
}

function Status() {
  const { modo } = useDados();
  return (
    <Card titulo="Onde os dados ficam salvos" icone={Database}>
      {modo === "nuvem" ? (
        <p className="text-sm">
          <Selo tom="ok" icone={Cloud}>
            Nuvem
          </Selo> — vocês dois veem os mesmos dados em qualquer aparelho, e o WhatsApp lança direto aqui.
        </p>
      ) : (
        <div className="space-y-2 text-sm">
          <p>
            <Selo tom="warn" icone={HardDrive}>
              Modo local
            </Selo> — os dados estão salvos só neste navegador. Para sincronizar entre vocês dois e receber mensagens do WhatsApp, configure o banco:
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-muted">
            <li>
              Na Vercel, abra o projeto → <strong>Storage</strong> → <strong>Create Database</strong> → <strong>Neon</strong> → conecte ao projeto (cria o{" "}
              <code>DATABASE_URL</code> sozinho; a tabela é criada automaticamente).
            </li>
            <li>Faça um novo deploy (Deployments → ⋯ → Redeploy).</li>
            <li>Antes de trocar, use “Exportar backup” aqui embaixo e depois “Importar backup” já na nuvem para levar o que lançaram.</li>
          </ol>
        </div>
      )}
    </Card>
  );
}

interface Aparelho {
  id: string;
  nome: string;
  criadoEm: string;
  ultimoUso?: string;
}

function Acesso() {
  const { modo, aviso } = useDados();
  const [aparelhos, setAparelhos] = useState<Aparelho[] | null>(null);
  const [suporta, setSuporta] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  async function carregar() {
    const r = await fetch("/api/passkey/lista").then((x) => (x.ok ? x.json() : { passkeys: [] }));
    setAparelhos((r as { passkeys: Aparelho[] }).passkeys);
  }
  useEffect(() => {
    digitalDisponivel().then(setSuporta);
    // busca assíncrona da lista de aparelhos
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (modo === "nuvem") carregar();
  }, [modo]);

  if (modo !== "nuvem") return null;
  return (
    <Card titulo="Acesso" icone={Fingerprint}>
      <p className="mb-3 text-sm text-muted">Vocês ficam conectados por 1 ano em cada aparelho. Com a digital / Face ID ativada, não precisa nem digitar o PIN.</p>
      {aparelhos && aparelhos.length > 0 && (
        <ul className="mb-3 divide-y divide-line rounded-xl border border-line text-sm">
          {aparelhos.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
                <Smartphone className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                {a.nome}
                <span className="block text-xs text-muted">
                  ativado em {dataBR(a.criadoEm.slice(0, 10))}
                  {a.ultimoUso && ` · último uso ${dataBR(a.ultimoUso.slice(0, 10))}`}
                </span>
              </span>
              <button
                type="button"
                className="text-xs text-danger"
                onClick={async () => {
                  if (!confirm(`Remover a digital do aparelho "${a.nome}"?`)) return;
                  await fetch("/api/passkey/remover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: a.id }) });
                  aviso("Aparelho removido");
                  carregar();
                }}
              >
                remover
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {suporta ? (
          <Botao
            disabled={ocupado}
            icone={Fingerprint}
            onClick={async () => {
              setOcupado(true);
              const r = await cadastrarDigital();
              setOcupado(false);
              if (r.ok) {
                aviso("Digital / Face ID ativada neste aparelho");
                carregar();
              } else aviso(r.erro, "erro");
            }}
          >
            {ocupado ? "Aguardando…" : "Ativar digital / Face ID neste aparelho"}
          </Botao>
        ) : (
          <p className="text-sm text-muted">Este navegador não oferece digital / Face ID.</p>
        )}
        <Botao
          variante="fantasma"
          icone={LogOut}
          onClick={async () => {
            await fetch("/api/login", { method: "DELETE" });
            window.location.replace("/login");
          }}
        >
          Sair deste aparelho
        </Botao>
      </div>
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
    <Card titulo="Casal e casamento" icone={UsersRound}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          // parte da config atual (não apaga o que foi mudado em outra tela, ex.: IDs do WhatsApp)
          const nova: Configuracoes = {
            ...banco.config,
            nomeP1: c.nomeP1,
            nomeP2: c.nomeP2,
            telefoneP1: c.telefoneP1,
            telefoneP2: c.telefoneP2,
            dataCasamento: c.dataCasamento,
            orcamentoCasamento: n(num.orcamentoCasamento),
            reservaInicial: n(num.reservaInicial),
            metaMensalGuardar: n(num.metaMensalGuardar),
            diaPadraoContas: Math.min(31, Math.max(1, Number(c.diaPadraoContas) || 6)),
          };
          await aplicar([{ tipo: "upsert", colecao: "config", id: "config", dados: nova }], "Ajustes salvos");
        }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo rotulo="Nome 1">
            <Input value={c.nomeP1} onChange={(e) => set("nomeP1", e.target.value)} />
          </Campo>
          <Campo rotulo="Nome 2">
            <Input value={c.nomeP2} onChange={(e) => set("nomeP2", e.target.value)} />
          </Campo>
          <Campo rotulo={`WhatsApp de ${c.nomeP1}`} dica="Com DDD. O robô do WhatsApp só atende os números cadastrados aqui.">
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

interface Recusado {
  id: string;
  lid: boolean;
  nome: string;
  texto: string;
  quando: string;
}

/** Números que tentaram usar o robô e não foram reconhecidos + IDs já aprovados. */
function Remetentes() {
  const { banco, aplicar, aviso, recarregar, modo } = useDados();
  const [lista, setLista] = useState<Recusado[]>([]);

  async function carregar() {
    const r = await fetch("/api/remetentes", { cache: "no-store" }).then((x) => (x.ok ? x.json() : { recusados: [] }));
    setLista((r as { recusados: Recusado[] }).recusados);
  }
  useEffect(() => {
    // busca assíncrona
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (modo === "nuvem") carregar();
  }, [modo]);

  async function aprovar(id: string, pessoa: "p1" | "p2") {
    const res = await fetch("/api/remetentes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, pessoa }) });
    if (!res.ok) return aviso("Não foi possível aprovar", "erro");
    aviso(`Pronto: agora o robô reconhece ${pessoa === "p1" ? banco.config.nomeP1 : banco.config.nomeP2} por esse número`);
    await recarregar();
    carregar();
  }

  async function descartar(id: string) {
    await fetch(`/api/remetentes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    carregar();
  }

  async function removerAprovado(campo: "whatsappExtraP1" | "whatsappExtraP2", id: string) {
    if (!confirm("Remover esse ID? O robô deixa de reconhecer esse número.")) return;
    const novos = (banco.config[campo] ?? []).filter((x) => x !== id);
    await aplicar([{ tipo: "upsert", colecao: "config", id: "config", dados: { ...banco.config, [campo]: novos } }], "ID removido");
  }

  const aprovados = [
    ...(banco.config.whatsappExtraP1 ?? []).map((id) => ({ id, campo: "whatsappExtraP1" as const, nome: banco.config.nomeP1 })),
    ...(banco.config.whatsappExtraP2 ?? []).map((id) => ({ id, campo: "whatsappExtraP2" as const, nome: banco.config.nomeP2 })),
  ];

  if (modo !== "nuvem") return null;
  return (
    <div className="space-y-3">
      {lista.length > 0 && (
        <div className="rounded-2xl border border-warn/30 bg-warn-soft p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-warn">
            <ShieldQuestion className="h-4 w-4" /> Tentaram usar o robô e não foram reconhecidos
          </div>
          <p className="mb-3 text-xs text-muted">
            Se for um de vocês, toque no nome para liberar. Às vezes o WhatsApp manda um código interno no lugar do telefone — por isso o número pode parecer estranho.
          </p>
          <ul className="space-y-2">
            {lista.map((r) => (
              <li key={r.id} className="rounded-xl bg-surface p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {r.nome || "Sem nome"} <span className="num text-xs font-normal text-muted">· {r.lid ? "código" : "número"} final {r.id.slice(-4)}</span>
                  </span>
                  <span className="text-xs text-muted">{new Date(r.quando).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                </div>
                {r.texto && <div className="mt-0.5 truncate text-xs text-muted">“{r.texto}”</div>}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Botao pequeno icone={UserCheck} onClick={() => aprovar(r.id, "p1")}>
                    É {banco.config.nomeP1}
                  </Botao>
                  <Botao pequeno icone={UserCheck} onClick={() => aprovar(r.id, "p2")}>
                    É {banco.config.nomeP2}
                  </Botao>
                  <Botao pequeno variante="fantasma" icone={X} onClick={() => descartar(r.id)}>
                    Não conheço
                  </Botao>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {aprovados.length > 0 && (
        <div className="text-xs text-muted">
          <span className="font-medium text-ink">IDs extras liberados:</span>{" "}
          {aprovados.map((a) => (
            <span key={a.id} className="mr-2 inline-flex items-center gap-1">
              {a.nome} (final {a.id.slice(-4)})
              <button type="button" className="text-danger" onClick={() => removerAprovado(a.campo, a.id)} aria-label="Remover">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function GrupoFinancas() {
  const { banco, aplicar } = useDados();
  const temGrupo = !!banco.config.grupoWhatsapp;
  const somente = !!banco.config.whatsappSomenteGrupo;
  const salvar = (dados: Partial<Configuracoes>, msg: string) => aplicar([{ tipo: "upsert", colecao: "config", id: "config", dados: { ...banco.config, ...dados } }], msg);
  return (
    <div className="mb-4 rounded-2xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <UsersRound className="h-4 w-4 text-brand" /> Grupo de finanças
        </div>
        {temGrupo ? (
          <Selo tom="ok" icone={Check}>
            vinculado
          </Selo>
        ) : (
          <Selo>não vinculado</Selo>
        )}
      </div>
      {temGrupo ? (
        <p className="mt-2 text-sm text-muted">No grupo vinculado o robô fica sempre ativo — não precisa de “iniciar finanças”.</p>
      ) : (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Criem um grupo no WhatsApp só com vocês dois (o número do robô precisa estar nele).</li>
          <li>
            Mandem <code className="rounded bg-surface-2 px-1">ativar grupo</code> dentro dele.
          </li>
        </ol>
      )}
      <label className={cx("mt-3 flex items-start gap-3 text-sm", !temGrupo && "opacity-50")}>
        <input
          type="checkbox"
          disabled={!temGrupo}
          checked={somente && temGrupo}
          onChange={(e) => salvar({ whatsappSomenteGrupo: e.target.checked }, e.target.checked ? "Robô lendo só o grupo de finanças" : "Modo somente grupo desligado")}
          className="mt-0.5 h-5 w-5 accent-[var(--brand)]"
        />
        <span>
          <strong>Ler somente o grupo de finanças</strong>
          <span className="block text-xs text-muted">
            Recomendado se o robô usa o número pessoal de um de vocês: qualquer outra conversa ou grupo é descartada na hora — sem resposta e sem guardar nada.
          </span>
        </span>
      </label>
      {temGrupo && (
        <button
          type="button"
          className="mt-3 text-xs text-danger"
          onClick={() => confirm("Desvincular o grupo de finanças?") && salvar({ grupoWhatsapp: "", whatsappSomenteGrupo: false }, "Grupo desvinculado")}
        >
          Desvincular grupo
        </button>
      )}
    </div>
  );
}

function OpcaoBotoes() {
  const { banco, aplicar } = useDados();
  const salvar = (dados: Partial<Configuracoes>, msg: string) => aplicar([{ tipo: "upsert", colecao: "config", id: "config", dados: { ...banco.config, ...dados } }], msg);
  const opcoes: { campo: "whatsappBomDia" | "whatsappEvangelho" | "whatsappEstudo" | "whatsappReacoes" | "whatsappImagens" | "whatsappBotoes"; titulo: string; desc: string }[] = [
    { campo: "whatsappBomDia", titulo: "Bom dia (7h–8h)", desc: "Compromissos de hoje, aniversariantes e tarefas a fazer. Nada financeiro. Vai para o grupo de finanças." },
    { campo: "whatsappEvangelho", titulo: "Evangelho do dia", desc: "Logo depois do bom dia, o evangelho da liturgia diária. A qualquer hora: mande evangelho." },
    { campo: "whatsappEstudo", titulo: "Lembrete de estudo (20h–21h)", desc: "À noite, um lembrete para estudar para os concursos, com uma dica diferente a cada dia." },
    { campo: "whatsappReacoes", titulo: "Confirmar com reação ✓", desc: "Lançamentos, contas pagas, compromissos e tarefas recebem só uma reação na mensagem de vocês — sem resposta em texto." },
    { campo: "whatsappImagens", titulo: "Consultas como cartão em imagem", desc: "resumo, contas, casamento, agenda, tarefas, aniversários e o bom dia chegam como imagem com a cara do app. Desligado, vêm em texto." },
    { campo: "whatsappBotoes", titulo: "Botões nas conversas privadas", desc: "Atalhos clicáveis (não aparecem em grupos). Se aparecer “mensagem não suportada”, desligue." },
  ];
  return (
    <div className="mt-4 space-y-2">
      <NomeRobo />
      <div className="rotulo">Estilo das respostas</div>
      {opcoes.map((o) => {
        const ligado = banco.config[o.campo] !== false;
        return (
          <label key={o.campo} className="flex items-start gap-3 rounded-xl border border-line p-3 text-sm">
            <input
              type="checkbox"
              checked={ligado}
              onChange={(e) => salvar({ [o.campo]: e.target.checked }, `${o.titulo}: ${e.target.checked ? "ligado" : "desligado"}`)}
              className="mt-0.5 h-5 w-5 accent-[var(--brand)]"
            />
            <span>
              {o.titulo}
              <span className="block text-xs text-muted">{o.desc}</span>
            </span>
          </label>
        );
      })}
      <PreviaCartoes />
    </div>
  );
}

function NomeRobo() {
  const { banco, aplicar } = useDados();
  const [nome, setNome] = useState(banco.config.nomeRobo ?? "");
  const salvar = () => {
    if (nome.trim() === (banco.config.nomeRobo ?? "")) return;
    aplicar([{ tipo: "upsert", colecao: "config", id: "config", dados: { ...banco.config, nomeRobo: nome.trim() } }], "Nome do robô salvo");
  };
  return (
    <div className="mb-4 rounded-xl border border-line p-3 text-sm">
      <Campo rotulo="Nome do robô" dica={nome.trim() ? `As mensagens começam com: ${nome.trim()}(bot):` : "Vazio: as mensagens vão sem assinatura"}>
        <Input value={nome} onChange={(e) => setNome(e.target.value)} onBlur={salvar} placeholder="Ex.: Ron Weasley" maxLength={40} />
      </Campo>
    </div>
  );
}

function PreviaCartoes() {
  const { modo } = useDados();
  const [tipo, setTipo] = useState<"bomdia" | "resumo" | "agenda" | "contas" | "casamento" | "tarefas" | "aniversarios" | "calendario" | "ajuda" | null>(null);
  const [versao, setVersao] = useState(0);
  if (modo !== "nuvem") return null;
  return (
    <div className="rounded-xl border border-line p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted">Ver prévia do cartão:</span>
        {(["bomdia", "resumo", "agenda", "contas", "casamento", "tarefas", "aniversarios", "calendario", "ajuda"] as const).map((t) => (
          <button key={t} type="button" onClick={() => {
              setTipo(tipo === t ? null : t);
              setVersao(Date.now());
            }} className={cx("rounded-full border px-3 py-1 capitalize", tipo === t ? "border-brand bg-brand-soft text-brand" : "border-line text-muted hover:text-ink")}>
            {t === "bomdia" ? "bom dia" : t === "aniversarios" ? "aniversários" : t === "calendario" ? "calendário" : t}
          </button>
        ))}
      </div>
      {tipo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={tipo} src={`/api/cartao?tipo=${tipo}&v=${versao}`} alt={`Prévia do cartão ${tipo}`} className="mx-auto mt-3 w-full max-w-sm rounded-2xl border border-line" />
      )}
    </div>
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
    <Card titulo="WhatsApp" icone={MessageCircle}>
      <p className="mb-4 text-sm text-muted">
        Mandem <code className="rounded bg-surface-2 px-1">iniciar finanças</code> para o número do robô para começar e{" "}
        <code className="rounded bg-surface-2 px-1">encerrar</code> para voltar à conversa normal.
      </p>
      <GrupoFinancas />
      <Remetentes />
      <OpcaoBotoes />
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-muted">Ver instruções e simulador</summary>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-2 text-sm">
          <p>Mandem mensagens como estas para o número conectado e o lançamento cai direto no sistema:</p>
          <pre className="whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-xs">{AJUDA_WHATSAPP.replace(/\*/g, "").replace(/`/g, "")}</pre>
          <details className="rounded-xl border border-line p-3">
            <summary className="cursor-pointer font-medium">Configurar na Evolution API</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
              <li>
                No painel da Evolution, abra a instância → <strong>Webhook</strong> → ative.
              </li>
              <li>
                URL: <code className="break-all">{origem}/api/whatsapp?token=SEU_WHATSAPP_WEBHOOK_TOKEN</code> (o token está na Vercel, variável{" "}
                <code>WHATSAPP_WEBHOOK_TOKEN</code>).
              </li>
              <li>
                Eventos: marque só <strong>MESSAGES_UPSERT</strong>. “Webhook by Events” e “Base64” desligados.
              </li>
              <li>
                <strong>Antes de testar</strong>, preencham os WhatsApps de vocês em “Casal e casamento” acima — o robô <strong>só responde vocês dois</strong>{" "}
                (mensagens de outras pessoas são ignoradas).
              </li>
              <li>
                Para lançar, mandem <code>iniciar finanças</code>. O robô confirma e passa a ler a conversa; <code>encerrar</code> (ou 10 min sem mensagens)
                volta para a conversa normal. Fora disso ele fica em silêncio — vale para conversas e grupos.
              </li>
              <li>Se o número da instância for de um de vocês, dá para lançar na conversa “comigo mesmo”.</li>
            </ol>
          </details>
          {modo !== "nuvem" && <p className="text-xs text-warn">O WhatsApp só funciona com o banco de dados conectado.</p>}
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
      </details>
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
    <Card
      titulo="Categorias"
      icone={Tags}
      acao={
        <Botao pequeno icone={Plus} onClick={() => setEditar("nova")}>
          Categoria
        </Botao>
      }
    >
      <p className="mb-4 flex items-center gap-1.5 text-xs text-muted">
        <House className="h-3.5 w-3.5" /> = entra no “custo da casa”. Toque numa categoria para editar nome, ícone e palavras-chave.
      </p>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {TIPOS.map((t) => (
          <div key={t.id}>
            <div className="rotulo mb-2">{t.nome}</div>
            <div className="space-y-1">
              {banco.categorias
                .filter((c) => c.tipo === t.id)
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setEditar(c)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-left text-sm transition hover:bg-surface-2"
                  >
                    <ChipCategoria categoria={c} tamanho="sm" />
                    <span className="flex-1 truncate">{c.nome}</span>
                    {c.casa && <House className="h-3.5 w-3.5 text-muted" aria-label="custo da casa" />}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
      <Modal aberto={editar !== null} aoFechar={() => setEditar(null)} titulo={editar === "nova" ? "Nova categoria" : "Editar categoria"}>
        {editar && <FormCategoria c={editar === "nova" ? undefined : editar} aoTerminar={() => setEditar(null)} />}
      </Modal>
    </Card>
  );
}

function FormCategoria({ c: inicial, aoTerminar }: { c?: Categoria; aoTerminar: () => void }) {
  const { banco, aplicar } = useDados();
  const [c, setC] = useState<Categoria>(inicial ?? { id: novoId(), nome: "", tipo: "despesa", icone: "outros", casa: false, palavras: "" });
  const iconeAtual = iconeDaCategoria(c);
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
      <Campo rotulo="Nome">
        <Input value={c.nome} onChange={(e) => set("nome", e.target.value)} required autoFocus={!inicial} />
      </Campo>
      <div>
        <span className="mb-1.5 block text-xs font-medium text-muted">Ícone</span>
        <div className="grid grid-cols-8 gap-1.5">
          {Object.entries(ICONES_CATEGORIA).map(([nome, Icone]) => (
            <button
              key={nome}
              type="button"
              onClick={() => set("icone", nome)}
              aria-label={nome}
              className={cx(
                "grid aspect-square place-items-center rounded-xl border transition",
                Icone === iconeAtual ? "border-brand bg-brand-soft text-brand" : "border-line text-muted hover:text-ink",
              )}
            >
              <Icone className="h-4 w-4" />
            </button>
          ))}
        </div>
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
          <input type="checkbox" checked={c.casa} onChange={(e) => set("casa", e.target.checked)} className="h-5 w-5 accent-[var(--brand)]" />
          Faz parte do custo da casa
        </label>
      )}
      <div className="flex gap-2">
        {inicial && (
          <Botao
            variante="perigo"
            icone={Trash2}
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
    <Card titulo="Instalar no celular" icone={Smartphone}>
      {instalado ? (
        <p className="flex items-center gap-1.5 text-sm text-ok">
          <Check className="h-4 w-4" /> O app já está instalado neste aparelho.
        </p>
      ) : (
        <div className="space-y-2 text-sm">
          {evento && (
            <Botao icone={Download} onClick={() => evento.prompt()}>
              Instalar agora
            </Botao>
          )}
          <p>
            <strong>iPhone (Safari):</strong> toque em <span className="inline-flex items-center gap-1 rounded bg-surface-2 px-1.5">
              Compartilhar <Upload className="h-3 w-3" />
            </span> → <strong>Adicionar à Tela de Início</strong>.
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
  const { banco, aplicar } = useDados();
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
    <Card titulo="Backup" icone={HardDrive}>
      <p className="mb-3 text-sm text-muted">Baixe uma cópia de tudo (arquivo .json) de vez em quando, por segurança.</p>
      <div className="flex flex-wrap gap-2">
        <Botao variante="secundario" icone={Download} onClick={exportar}>
          Exportar backup
        </Botao>
        <label className={cx("inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium hover:bg-surface-2")}>
          <Upload className="h-4 w-4" /> Importar backup
          <input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])} />
        </label>
      </div>
      {msg && <p className="mt-2 text-sm text-danger">{msg}</p>}
    </Card>
  );
}
