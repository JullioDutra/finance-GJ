import { NextResponse } from "next/server";
import { aplicarNoServidor, bancoConfigurado, carregarBanco } from "@/lib/server/db";
import { pessoaPorTelefone, processarMensagem } from "@/lib/whatsapp";

// Webhook do WhatsApp. Aceita vários provedores:
//  • Meta WhatsApp Cloud API (oficial)           -> responde pela Graph API (se WHATSAPP_CLOUD_TOKEN)
//  • Twilio (form-urlencoded Body/From)          -> responde em TwiML
//  • Z-API, Evolution API, n8n/Make/genérico JSON -> responde em JSON { resposta }
// Segurança: ?token=WHATSAPP_WEBHOOK_TOKEN na URL ou header x-webhook-token.

function hojeSP(): string {
  // data de hoje no fuso de Brasília (o servidor da Vercel roda em UTC)
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function tokenOk(req: Request, url: URL): boolean {
  const esperado = process.env.WHATSAPP_WEBHOOK_TOKEN;
  if (!esperado) return true;
  return url.searchParams.get("token") === esperado || req.headers.get("x-webhook-token") === esperado;
}

// Verificação do webhook da Meta
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.WHATSAPP_WEBHOOK_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ ok: true, info: "Webhook do WhatsApp do Finanças G&J. Envie mensagens via POST." });
}

interface Recebida {
  de: string;
  texto: string;
  provedor: "meta" | "twilio" | "generico";
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

function extrair(body: Json): Recebida | null | "ignorar" {
  // Meta Cloud API
  if (body.object === "whatsapp_business_account") {
    const value = obj(obj((obj((body.entry as unknown[])?.[0]).changes as unknown[])?.[0]).value);
    const msg = obj((value.messages as unknown[])?.[0]);
    if (!msg.from) return "ignorar"; // status de entrega etc.
    const texto = str(obj(msg.text).body) || str(obj(obj(msg.button)).text) || str(obj(obj(msg.interactive).button_reply).title);
    return { de: str(msg.from), texto, provedor: "meta" };
  }
  // Evolution API
  const data = obj(body.data);
  if (data.key && data.message) {
    if (obj(data.key).fromMe === true) return "ignorar";
    const m = obj(data.message);
    const texto = str(m.conversation) || str(obj(m.extendedTextMessage).text);
    return { de: str(obj(data.key).remoteJid).split("@")[0], texto, provedor: "generico" };
  }
  // Z-API
  if (body.phone && body.text && typeof body.text === "object") {
    if (body.fromMe === true) return "ignorar";
    return { de: str(body.phone), texto: str(obj(body.text).message), provedor: "generico" };
  }
  // Genérico
  const texto = str(body.text) || str(body.message) || str(body.mensagem) || str(body.body) || str(body.Body);
  const de = str(body.from) || str(body.phone) || str(body.telefone) || str(body.sender) || str(body.From);
  if (!texto) return null;
  return { de: de.replace(/^whatsapp:/, ""), texto, provedor: "generico" };
}

async function responderMeta(para: string, texto: string) {
  const token = process.env.WHATSAPP_CLOUD_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return;
  await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: para, type: "text", text: { body: texto } }),
  }).catch(() => undefined);
}

const escXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function POST(req: Request) {
  const url = new URL(req.url);
  if (!tokenOk(req, url)) return NextResponse.json({ erro: "Token inválido" }, { status: 401 });
  if (!bancoConfigurado()) {
    return NextResponse.json({ erro: "Banco de dados não configurado. Conecte o banco (Neon ou Supabase) para receber mensagens." }, { status: 503 });
  }

  const tipo = req.headers.get("content-type") ?? "";
  let recebida: Recebida | null | "ignorar";
  if (tipo.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData();
    recebida = { de: str(form.get("From")).replace(/^whatsapp:/, ""), texto: str(form.get("Body")), provedor: "twilio" };
  } else {
    const body = obj(await req.json().catch(() => ({})));
    recebida = extrair(body);
  }
  if (recebida === "ignorar") return NextResponse.json({ ok: true, ignorado: true });
  if (!recebida) return NextResponse.json({ erro: "Mensagem sem texto" }, { status: 400 });

  try {
    const banco = await carregarBanco();
    const pessoa = pessoaPorTelefone(banco, recebida.de);
    const r = processarMensagem(banco, recebida.texto, pessoa, hojeSP());
    if (r.ops.length) await aplicarNoServidor(r.ops);

    if (recebida.provedor === "twilio") {
      return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escXml(r.resposta)}</Message></Response>`, {
        headers: { "Content-Type": "text/xml" },
      });
    }
    if (recebida.provedor === "meta") await responderMeta(recebida.de, r.resposta);
    return NextResponse.json({ ok: r.ok, resposta: r.resposta, para: recebida.de });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
