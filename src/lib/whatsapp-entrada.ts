// Lê o corpo (JSON) que cada provedor de WhatsApp manda no webhook e devolve
// quem mandou + o texto. Função pura, testada em scripts/testar-logica.ts.

import { ehMensagemDoRobo } from "./whatsapp-modelos";

/** legado: respostas antigas começavam com este emoji */
export const MARCA_BOT = "🤖";

export interface Recebida {
  de: string; // telefone (só dígitos quando possível)
  nome: string; // nome do perfil no WhatsApp (pushName), se houver
  texto: string;
  provedor: "meta" | "twilio" | "evolution" | "generico";
  /** Evolution: para onde responder (jid do contato ou do grupo) */
  responderPara?: string;
  instancia?: string;
  servidor?: string;
  apikey?: string;
  /** true quando o WhatsApp mandou só o código interno (LID) e não o telefone */
  lid?: boolean;
  /** mensagem enviada pelo próprio número da instância (conversa "comigo mesmo") */
  propria?: boolean;
  grupo?: boolean;
  /** número da própria instância (dígitos) */
  dono?: string;
  /** chave original da mensagem (para reagir a ela) */
  chave?: { remoteJid: string; fromMe: boolean; id: string; participant?: string };
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const digitos = (jid: string) => jid.split("@")[0].split(":")[0].replace(/\D/g, "");

function evolution(body: Json): Recebida | "ignorar" | null {
  const evento = str(body.event).toLowerCase().replace(/_/g, ".");
  if (evento && evento !== "messages.upsert") return "ignorar";
  const data = obj(Array.isArray(body.data) ? body.data[0] : body.data);
  const key = obj(data.key);
  const m = obj(data.message);
  // clique em botão: o id do botão é o próprio comando (ex.: "resumo", "desfazer <id>")
  const idBotao = (() => {
    const nf = obj(obj(m.interactiveResponseMessage).nativeFlowResponseMessage);
    try {
      const params = JSON.parse(str(nf.paramsJson) || "{}") as { id?: unknown };
      if (typeof params.id === "string" && params.id) return params.id;
    } catch {
      /* ignora */
    }
    return (
      str(obj(m.buttonsResponseMessage).selectedButtonId) ||
      str(obj(m.templateButtonReplyMessage).selectedId) ||
      str(obj(obj(m.listResponseMessage).singleSelectReply).selectedRowId)
    );
  })();
  const texto =
    idBotao ||
    str(m.conversation) ||
    str(obj(m.extendedTextMessage).text) ||
    str(obj(m.imageMessage).caption) ||
    str(obj(obj(m.ephemeralMessage).message).conversation) ||
    str(obj(obj(obj(m.ephemeralMessage).message).extendedTextMessage).text) ||
    str(obj(obj(m.interactiveResponseMessage).body).text);
  if (!texto) return "ignorar"; // áudio, figurinha, reação etc.

  const remoteJid = str(key.remoteJid);
  const grupo = remoteJid.endsWith("@g.us");
  const dono = str(body.sender); // número da própria instância
  const fromMe = key.fromMe === true;

  if (fromMe) {
    // Mensagem enviada pelo próprio número da instância: nunca as respostas do robô (evita loop).
    // Em conversa direta só vale a "comigo mesmo"; em grupo passa adiante e a rota decide
    // (só o grupo de finanças é lido).
    if (ehMensagemDoRobo(texto)) return "ignorar";
    const conversaComigo = !grupo && dono && digitos(remoteJid) === digitos(dono);
    if (!grupo && !conversaComigo) return "ignorar";
  }

  // Em grupo, quem mandou é o participant. No formato novo (@lid) o telefone vem nos campos *Alt / senderPn.
  const candidatos = grupo
    ? [str(key.participantAlt), str(key.participantPn), str(key.participant), str(data.participant)]
    : [str(key.senderPn), str(key.remoteJidAlt), remoteJid];
  if (fromMe) candidatos.unshift(dono);
  const comTelefone = candidatos.find((c) => c && !c.endsWith("@lid") && digitos(c).length >= 8) ?? candidatos.find(Boolean) ?? "";

  return {
    de: digitos(comTelefone),
    lid: comTelefone.endsWith("@lid"),
    nome: str(data.pushName),
    texto,
    provedor: "evolution",
    responderPara: remoteJid,
    instancia: str(body.instance),
    servidor: str(body.server_url),
    apikey: str(body.apikey),
    propria: fromMe,
    grupo,
    dono: digitos(dono),
    chave: str(key.id)
      ? { remoteJid: str(key.remoteJid), fromMe, id: str(key.id), ...(str(key.participant) ? { participant: str(key.participant) } : {}) }
      : undefined,
  };
}

export function extrairMensagem(body: Json): Recebida | null | "ignorar" {
  // Meta Cloud API
  if (body.object === "whatsapp_business_account") {
    const value = obj(obj((obj((body.entry as unknown[])?.[0]).changes as unknown[])?.[0]).value);
    const msg = obj((value.messages as unknown[])?.[0]);
    if (!msg.from) return "ignorar"; // status de entrega etc.
    const texto = str(obj(msg.text).body) || str(obj(msg.button).text) || str(obj(obj(msg.interactive).button_reply).title);
    const nome = str(obj(obj((value.contacts as unknown[])?.[0]).profile).name);
    return { de: str(msg.from), nome, texto, provedor: "meta" };
  }
  // Evolution API
  const data = obj(Array.isArray(body.data) ? body.data[0] : body.data);
  if ((data.key && data.message) || (str(body.event) && "instance" in body)) return evolution(body);
  // Z-API
  if (body.phone && body.text && typeof body.text === "object") {
    if (body.fromMe === true) return "ignorar";
    return { de: str(body.phone), nome: str(body.senderName), texto: str(obj(body.text).message), provedor: "generico" };
  }
  // Genérico (n8n, Make…)
  const texto = str(body.text) || str(body.message) || str(body.mensagem) || str(body.body) || str(body.Body);
  const de = str(body.from) || str(body.phone) || str(body.telefone) || str(body.sender) || str(body.From);
  if (!texto) return null;
  return { de: de.replace(/^whatsapp:/, ""), nome: str(body.nome) || str(body.name), texto, provedor: "generico" };
}
