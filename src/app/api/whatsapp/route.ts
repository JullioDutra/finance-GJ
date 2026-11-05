import { NextResponse } from "next/server";
import { aplicarNoServidor, bancoConfigurado, carregarBanco, gravarInterno, lerInterno } from "@/lib/server/db";
import { identificarPessoa, processarMensagem } from "@/lib/whatsapp";
import type { PessoaId } from "@/lib/types";
import { extrairMensagem, type Recebida } from "@/lib/whatsapp-entrada";
import { BOTOES_FIM, BOTOES_INICIO, comandoSessao, MSG_FIM, MSG_INICIO, novaExpiracao, sessaoAtiva, type SessaoWhatsapp } from "@/lib/whatsapp-sessao";
import { separarCartao, type BotaoWhats } from "@/lib/whatsapp-modelos";

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

function dadosEvolution(r: Recebida) {
  const servidor = (process.env.EVOLUTION_API_URL || r.servidor || "").replace(/\/+$/, "");
  const apikey = process.env.EVOLUTION_API_KEY || r.apikey || "";
  const instancia = process.env.EVOLUTION_INSTANCE || r.instancia || "";
  return servidor && apikey && instancia && r.responderPara ? { servidor, apikey, instancia } : null;
}

async function postEvolution(caminho: string, apikey: string, corpo: unknown): Promise<boolean> {
  try {
    const res = await fetch(caminho, {
      method: "POST",
      headers: { apikey, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error("evolution: falha ao responder", caminho.split("/").slice(-2, -1)[0], res.status, (await res.text()).slice(0, 300));
    return res.ok;
  } catch (e) {
    console.error("evolution: erro ao responder", e);
    return false;
  }
}

/** Responde pela Evolution: com botões (se houver e estiverem ligados) e, se falhar, em texto puro. */
async function responderEvolution(r: Recebida, texto: string, botoes?: BotaoWhats[], usarBotoes = true) {
  const d = dadosEvolution(r);
  if (!d) {
    console.warn("evolution: sem dados para responder");
    return false;
  }
  const base = `${d.servidor}/message`;
  const inst = encodeURIComponent(d.instancia);
  if (usarBotoes && botoes?.length) {
    const { titulo, corpo, rodape } = separarCartao(texto);
    const ok = await postEvolution(`${base}/sendButtons/${inst}`, d.apikey, {
      number: r.responderPara,
      title: titulo,
      description: corpo,
      footer: rodape || "G&J Finanças",
      buttons: botoes.slice(0, 3).map((bt) => ({ type: "reply", displayText: bt.texto, id: bt.id })),
    });
    if (ok) return true;
  }
  return postEvolution(`${base}/sendText/${inst}`, d.apikey, { number: r.responderPara, text: texto });
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
    const conhecida = identificarPessoa(banco, recebida.de);
    let pessoa: PessoaId = conhecida ?? "casal";

    if (recebida.provedor === "evolution") {
      // O número da Evolution pode ser o WhatsApp pessoal de vocês: só atende os números
      // cadastrados (ou a conversa "comigo mesmo").
      if (!conhecida && !recebida.propria) {
        const cad = [banco.config.telefoneP1, banco.config.telefoneP2].map((t) => t.replace(/\D/g, "").slice(-4)).filter(Boolean);
        console.info(
          `whatsapp: ignorado ${recebida.lid ? "código interno (LID)" : "telefone"} final ${recebida.de.slice(-4) || "?"}` +
            ` — cadastrados: ${cad.length ? cad.map((c) => `final ${c}`).join(", ") : "nenhum"}`,
        );
        // guarda para aprovação em Ajustes (só quem está logado no app pode aprovar)
        if (recebida.de) {
          await gravarInterno("_whatsapp_recusados", recebida.de, {
            id: recebida.de,
            lid: !!recebida.lid,
            nome: recebida.nome.slice(0, 60),
            texto: recebida.texto.slice(0, 60),
            quando: new Date().toISOString(),
          });
        }
        return NextResponse.json({ ok: true, ignorado: "remetente desconhecido" });
      }
      if (recebida.propria && !conhecida) pessoa = identificarPessoa(banco, recebida.de) ?? "casal";

      // Modo finanças: só lê a conversa depois de "iniciar finanças"; fora disso é conversa normal.
      const conversa = recebida.responderPara || recebida.de;
      const agora = Date.now();
      const sessao = (await lerInterno<SessaoWhatsapp>("_whatsapp_sessoes")).find((x) => x.id === conversa);
      const comando = comandoSessao(recebida.texto);
      if (comando === "iniciar") {
        await gravarInterno("_whatsapp_sessoes", conversa, { id: conversa, expira: novaExpiracao(agora) });
        await responderEvolution(recebida, MSG_INICIO, BOTOES_INICIO, banco.config.whatsappBotoes !== false);
        return NextResponse.json({ ok: true, sessao: "iniciada" });
      }
      if (!sessaoAtiva(sessao, agora)) return NextResponse.json({ ok: true, ignorado: "fora do modo finanças" });
      if (comando === "encerrar") {
        await gravarInterno("_whatsapp_sessoes", conversa, null);
        await responderEvolution(recebida, MSG_FIM, BOTOES_FIM, banco.config.whatsappBotoes !== false);
        return NextResponse.json({ ok: true, sessao: "encerrada" });
      }
      await gravarInterno("_whatsapp_sessoes", conversa, { id: conversa, expira: novaExpiracao(agora) });
    }

    const r = processarMensagem(banco, recebida.texto, pessoa, hojeSP());
    if (r.ops.length) await aplicarNoServidor(r.ops);

    if (recebida.provedor === "twilio") {
      return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escXml(r.resposta)}</Message></Response>`, {
        headers: { "Content-Type": "text/xml" },
      });
    }
    let respondido: boolean | undefined;
    if (recebida.provedor === "meta") await responderMeta(recebida.de, r.resposta);
    if (recebida.provedor === "evolution") respondido = await responderEvolution(recebida, r.resposta, r.botoes, banco.config.whatsappBotoes !== false);
    return NextResponse.json({ ok: r.ok, pessoa, resposta: r.resposta, respondido });
  } catch (e) {
    console.error("whatsapp", e);
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
