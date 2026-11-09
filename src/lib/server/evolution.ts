import "server-only";
import { gravarInterno, lerInterno } from "./db";
import { MARCA } from "../whatsapp-modelos";

// Envio pela Evolution API, usado pelo webhook (respostas) e pelo "bom dia" das 7h (sem mensagem recebida).

export interface ConexaoEvolution {
  servidor: string;
  apikey: string;
  instancia: string;
}

interface ConexaoSalva extends ConexaoEvolution {
  id: "evolution";
  quando: string;
}

/** Variáveis da Vercel > dados do webhook > última conexão salva. */
export function montarConexao(r?: { servidor?: string; apikey?: string; instancia?: string }, salva?: Partial<ConexaoEvolution>): ConexaoEvolution | null {
  const servidor = (process.env.EVOLUTION_API_URL || r?.servidor || salva?.servidor || "").replace(/\/+$/, "");
  const apikey = process.env.EVOLUTION_API_KEY || r?.apikey || salva?.apikey || "";
  const instancia = process.env.EVOLUTION_INSTANCE || r?.instancia || salva?.instancia || "";
  return servidor && apikey && instancia ? { servidor, apikey, instancia } : null;
}

let ultimaSalva = "";
/** Guarda a conexão vista no webhook (servidor/instância/apikey) para o envio agendado poder usar. */
export async function lembrarConexao(r: { servidor?: string; apikey?: string; instancia?: string }) {
  const c = montarConexao(r);
  if (!c) return;
  const chave = `${c.servidor}|${c.instancia}|${c.apikey}`;
  if (chave === ultimaSalva) return;
  try {
    const atual = (await lerInterno<ConexaoSalva>("_whatsapp_conexao"))[0];
    if (!atual || `${atual.servidor}|${atual.instancia}|${atual.apikey}` !== chave) {
      await gravarInterno("_whatsapp_conexao", "evolution", { id: "evolution", ...c, quando: new Date().toISOString() });
    }
    ultimaSalva = chave;
  } catch (e) {
    console.error("evolution: não salvou a conexão", e);
  }
}

export async function conexaoSalva(): Promise<ConexaoEvolution | null> {
  const s = (await lerInterno<ConexaoSalva>("_whatsapp_conexao"))[0];
  return montarConexao(undefined, s);
}

/** Guarda os ids das mensagens do robô para nunca reprocessá-las (limpa as de mais de 2 dias). */
async function registrarEnviada(id: string) {
  try {
    await gravarInterno("_whatsapp_enviadas", id, { id, quando: Date.now() });
    if (Math.random() < 0.05) {
      const limite = Date.now() - 2 * 86_400_000;
      for (const e of await lerInterno<{ id: string; quando: number }>("_whatsapp_enviadas")) if (e.quando < limite) await gravarInterno("_whatsapp_enviadas", e.id, null);
    }
  } catch (e) {
    console.error("whatsapp: não registrou mensagem enviada", e);
  }
}

/** POST na Evolution. Devolve se deu certo e guarda o id da mensagem enviada (anti-loop). */
export async function postEvolution(c: ConexaoEvolution, rota: string, corpo: unknown): Promise<boolean> {
  const caminho = `${c.servidor}/message/${rota}/${encodeURIComponent(c.instancia)}`;
  try {
    const res = await fetch(caminho, {
      method: "POST",
      headers: { apikey: c.apikey, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error("evolution: falha ao enviar", rota, res.status, (await res.text()).slice(0, 300));
      return false;
    }
    const json = (await res.json().catch(() => ({}))) as { key?: { id?: string } };
    if (json.key?.id) await registrarEnviada(json.key.id);
    return true;
  } catch (e) {
    console.error("evolution: erro ao enviar", rota, e);
    return false;
  }
}

export const enviarTexto = (c: ConexaoEvolution, para: string, texto: string) => postEvolution(c, "sendText", { number: para, text: texto });

export const enviarImagem = (c: ConexaoEvolution, para: string, base64: string, legenda: string) =>
  postEvolution(c, "sendMedia", { number: para, mediatype: "image", mimetype: "image/png", fileName: "gj.png", caption: `${MARCA}${legenda}`, media: base64 });
