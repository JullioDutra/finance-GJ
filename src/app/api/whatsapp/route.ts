import { NextResponse } from "next/server";
import { aplicarNoServidor, bancoConfigurado, carregarBanco } from "@/lib/server/db";
import { pessoaPorTelefone, processarMensagem } from "@/lib/whatsapp";
import { extrairMensagem, MARCA_BOT, type Recebida } from "@/lib/whatsapp-entrada";

// Webhook do WhatsApp. Provedores aceitos:
//  • Evolution API (principal)          -> responde pela API da Evolution (/message/sendText)
//  • Meta WhatsApp Cloud API (oficial)  -> responde pela Graph API (se WHATSAPP_CLOUD_TOKEN)
//  • Twilio (form-urlencoded)           -> responde em TwiML
//  • Z-API / n8n / Make / genérico JSON -> responde em JSON { resposta }
// Segurança: ?token=WHATSAPP_WEBHOOK_TOKEN na URL ou header x-webhook-token.

function hojeSP(): string {
  // data de hoje no fuso de Brasília (o servidor da Vercel roda em UTC)
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function tokenOk(req: Request, url: URL): boolean {
  const esperado = process.env.WHATSAPP_WEBHOOK_TOKEN;
  if (!esperado) return true;
  // Com "Webhook by Events", a Evolution pode colar o evento depois do token (?token=XYZ/messages-upsert)
  const t = url.searchParams.get("token") ?? "";
  return t === esperado || t.startsWith(`${esperado}/`) || req.headers.get("x-webhook-token") === esperado;
}

// Verificação do webhook da Meta / teste no navegador
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.WHATSAPP_WEBHOOK_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({
    ok: true,
    info: "Webhook do WhatsApp do Finanças G&J. Envie mensagens via POST.",
    tokenValido: tokenOk(req, url),
    evolutionConfigurada: !!(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY),
  });
}

async function responderEvolution(r: Recebida, texto: string) {
  const servidor = (process.env.EVOLUTION_API_URL || r.servidor || "").replace(/\/+$/, "");
  const apikey = process.env.EVOLUTION_API_KEY || r.apikey || "";
  const instancia = process.env.EVOLUTION_INSTANCE || r.instancia || "";
  if (!servidor || !apikey || !instancia || !r.responderPara) {
    console.warn("evolution: sem dados para responder", { servidor: !!servidor, apikey: !!apikey, instancia });
    return false;
  }
  try {
    const res = await fetch(`${servidor}/message/sendText/${encodeURIComponent(instancia)}`, {
      method: "POST",
      headers: { apikey, "Content-Type": "application/json" },
      body: JSON.stringify({ number: r.responderPara, text: `${MARCA_BOT} ${texto}` }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error("evolution: falha ao responder", res.status, (await res.text()).slice(0, 300));
    return res.ok;
  } catch (e) {
    console.error("evolution: erro ao responder", e);
    return false;
  }
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
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

export async function POST(req: Request) {
  const url = new URL(req.url);
  if (!tokenOk(req, url)) return NextResponse.json({ erro: "Token inválido" }, { status: 401 });
  if (!bancoConfigurado()) {
    return NextResponse.json({ erro: "Banco de dados não configurado." }, { status: 503 });
  }

  const tipo = req.headers.get("content-type") ?? "";
  let recebida: Recebida | null | "ignorar";
  if (tipo.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData();
    recebida = { de: str(form.get("From")).replace(/^whatsapp:/, ""), nome: str(form.get("ProfileName")), texto: str(form.get("Body")), provedor: "twilio" };
  } else {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    recebida = extrairMensagem(body);
  }
  if (recebida === "ignorar") return NextResponse.json({ ok: true, ignorado: true });
  if (!recebida) return NextResponse.json({ erro: "Mensagem sem texto" }, { status: 400 });

  try {
    const banco = await carregarBanco();
    const pessoa = pessoaPorTelefone(banco, recebida.de, recebida.nome);
    const r = processarMensagem(banco, recebida.texto, pessoa, hojeSP());
    if (r.ops.length) await aplicarNoServidor(r.ops);

    if (recebida.provedor === "twilio") {
      return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escXml(r.resposta)}</Message></Response>`, {
        headers: { "Content-Type": "text/xml" },
      });
    }
    let respondido: boolean | undefined;
    if (recebida.provedor === "meta") await responderMeta(recebida.de, r.resposta);
    if (recebida.provedor === "evolution") respondido = await responderEvolution(recebida, r.resposta);
    return NextResponse.json({ ok: r.ok, pessoa, resposta: r.resposta, respondido });
  } catch (e) {
    console.error("whatsapp", e);
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
