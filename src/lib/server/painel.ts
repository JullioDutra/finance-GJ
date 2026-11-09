import "server-only";
import { gravarInterno, lerInterno } from "./db";
import { conexaoSalva, enviarTexto } from "./evolution";
import { destinosAgendados } from "./agendados";
import type { Banco } from "../types";
import {
  buscarConvites,
  textoAvisoConfirmacoes,
  textoConvite,
  textoListaConvidados,
  textoNovoConvite,
  textoResumoConvidados,
  type AvisoConfirmacao,
  type ComandoConvidados,
  type ConfirmacaoPainel,
  type ConvitePainel,
  type ResumoPainel,
} from "../convidados";
import { cartao, type PedidoImagem } from "../whatsapp-modelos";

// Painel dos Noivos (site do casamento no PythonAnywhere): API JSON com Bearer PAINEL_API_TOKEN.
// PAINEL_NOIVOS_URL muda o endereço (padrão: o site de vocês).

const BASE = () => (process.env.PAINEL_NOIVOS_URL || "https://gabriellaejullio.pythonanywhere.com/painel/api/").replace(/\/?$/, "/");
export const painelConfigurado = () => !!process.env.PAINEL_API_TOKEN;

class ErroPainel extends Error {}

async function chamar<T>(rota: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!painelConfigurado()) throw new ErroPainel("Integração com o painel desligada: falta PAINEL_API_TOKEN na Vercel.");
  let res: Response;
  try {
    res = await fetch(BASE() + rota, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${process.env.PAINEL_API_TOKEN}`, Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
  } catch (e) {
    console.error("painel: sem resposta", rota, e);
    throw new ErroPainel("O painel do casamento não respondeu. Tente de novo daqui a pouco.");
  }
  const json = (await res.json().catch(() => ({}))) as T & { erro?: string };
  if (!res.ok) {
    console.error("painel:", rota, res.status, json.erro);
    throw new ErroPainel(res.status === 401 ? "O painel recusou o token (PAINEL_API_TOKEN diferente nos dois lugares)." : res.status === 503 ? "A API do painel está desligada (falta PAINEL_API_TOKEN no PythonAnywhere)." : (json.erro ?? `O painel respondeu ${res.status}.`));
  }
  return json;
}

export const resumoPainel = () => chamar<ResumoPainel>("resumo/");
export const listaPainel = async (status?: string) => (await chamar<{ convidados: ConvitePainel[] }>(`convidados/${status && status !== "todos" ? `?status=${status}` : ""}`)).convidados;
const confirmacoesDesde = async (desde: string) => (await chamar<{ confirmacoes: ConfirmacaoPainel[] }>(`confirmacoes/?desde=${encodeURIComponent(desde)}`)).confirmacoes;

export interface RespostaPainel {
  ok: boolean;
  texto: string;
  imagem?: PedidoImagem;
  reagir?: string;
}

/** Executa um comando de convidados vindo do WhatsApp. */
export async function executarComandoConvidados(cmd: ComandoConvidados): Promise<RespostaPainel> {
  try {
    if (cmd.tipo === "resumo") {
      const r = await resumoPainel();
      return { ok: true, texto: textoResumoConvidados(r), imagem: { tipo: "convidados", resumo: r } };
    }
    if (cmd.tipo === "lista") {
      const lista = (await listaPainel(cmd.status)).sort((a, b) => a.nome.localeCompare(b.nome));
      return { ok: true, texto: textoListaConvidados(lista, cmd.status) };
    }
    if (cmd.tipo === "novo") {
      const existentes = buscarConvites(await listaPainel(), cmd.nome).filter((c) => c.nome.toLowerCase() === cmd.nome.toLowerCase());
      if (existentes.length) return { ok: false, texto: cartao("*Esse convite já existe*", [`- ${existentes[0].nome} · ${existentes[0].quantidade_esperada} pessoa(s) _#${existentes[0].id}_`]) };
      const c = await chamar<ConvitePainel>("convidados/", { method: "POST", body: { nome: cmd.nome, quantidade_esperada: cmd.quantidade, telefone: cmd.telefone } });
      return { ok: true, texto: textoNovoConvite(c), reagir: "✅" };
    }
    const lista = await listaPainel();
    if (cmd.tipo === "ver") {
      const achados = buscarConvites(lista, cmd.busca);
      if (achados.length === 1) return { ok: true, texto: textoConvite(achados[0]) };
      return {
        ok: false,
        texto: cartao(achados.length ? "*Qual deles?*" : "*Não encontrei esse convite*", achados.length ? achados.slice(0, 10).map((c) => `- ${c.nome} _#${c.id}_`) : ["Confira o nome com `todos os convidados`."]),
      };
    }
    // remover
    const achados = cmd.id ? lista.filter((c) => c.id === cmd.id) : buscarConvites(lista, cmd.busca);
    if (achados.length !== 1) {
      return {
        ok: false,
        texto: cartao(achados.length ? "*Mais de um convite com esse nome*" : "*Não encontrei esse convite*", achados.length ? [...achados.slice(0, 10).map((c) => `- ${c.nome} _#${c.id}_`), "", "Mande `remover convidado <número>`, ex.: `remover convidado " + achados[0].id + "`"] : ["Confira o nome com `todos os convidados`."]),
      };
    }
    const c = achados[0];
    await chamar(`convidados/${c.id}/`, { method: "DELETE" });
    return { ok: true, texto: cartao("*Convite removido*", [`~${c.nome}~ · ${c.quantidade_esperada} pessoa(s)`], `Para colocar de volta: novo convidado ${c.nome} ${c.quantidade_esperada}`), reagir: "✅" };
  } catch (e) {
    if (e instanceof ErroPainel) return { ok: false, texto: cartao("*Painel do casamento*", [e.message]) };
    throw e;
  }
}

// ---------- avisos de novas confirmações ----------
interface EstadoPainel {
  id: "estado";
  desde: string; // ISO da última verificação
  anunciados: number[]; // ids de confirmações já avisadas no grupo
}

async function lerEstado(): Promise<EstadoPainel | null> {
  return (await lerInterno<EstadoPainel>("_painel"))[0] ?? null;
}

/** Manda no grupo as confirmações ainda não avisadas. Devolve quantas foram avisadas. */
export async function anunciarConfirmacoes(banco: Banco, avisos: AvisoConfirmacao[], resumo: ResumoPainel | null): Promise<number> {
  const estado = (await lerEstado()) ?? { id: "estado" as const, desde: new Date().toISOString(), anunciados: [] };
  const novos = avisos.filter((a) => !estado.anunciados.includes(a.confirmacao.id));
  if (!novos.length) return 0;
  const conexao = await conexaoSalva();
  const destinos = destinosAgendados(banco);
  if (!conexao || !destinos.length) {
    console.warn("painel: confirmação recebida, mas a Evolution ou o grupo ainda não são conhecidos");
    return 0;
  }
  const texto = textoAvisoConfirmacoes(novos, resumo);
  let ok = false;
  for (const para of destinos) ok = (await enviarTexto(conexao, para, texto, banco.config.nomeRobo)) || ok;
  if (ok) {
    estado.anunciados = [...estado.anunciados, ...novos.map((a) => a.confirmacao.id)].slice(-300);
    await gravarInterno("_painel", "estado", estado);
  }
  return ok ? novos.length : 0;
}

/** Consulta o painel (para quando o PythonAnywhere não consegue chamar o webhook). */
export async function verificarConfirmacoes(banco: Banco): Promise<{ novas: number; erro?: string }> {
  if (!painelConfigurado()) return { novas: 0, erro: "PAINEL_API_TOKEN não configurado" };
  const agora = new Date().toISOString();
  const estado = await lerEstado();
  if (!estado) {
    // primeira vez: começa a contar a partir de agora (não despeja as confirmações antigas no grupo)
    await gravarInterno("_painel", "estado", { id: "estado", desde: agora, anunciados: [] });
    return { novas: 0 };
  }
  try {
    const confs = await confirmacoesDesde(estado.desde);
    const pendentes = confs.filter((c) => !estado.anunciados.includes(c.id)).reverse();
    let novas = 0;
    if (pendentes.length) {
      const [lista, resumo] = await Promise.all([listaPainel(), resumoPainel()]);
      const avisos = pendentes.map((c) => ({ confirmacao: c, convite: lista.find((l) => l.confirmacoes_site.some((r) => r.id === c.id)) ?? null }));
      novas = await anunciarConfirmacoes(banco, avisos, resumo);
    }
    // só avança a data se tudo foi avisado (senão tenta de novo na próxima verificação)
    if (novas === pendentes.length) {
      const atual = (await lerEstado()) ?? estado;
      await gravarInterno("_painel", "estado", { ...atual, desde: agora });
    }
    return { novas };
  } catch (e) {
    return { novas: 0, erro: (e as Error).message };
  }
}
