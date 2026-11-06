import { NextResponse } from "next/server";
import { aplicarNoServidor, bancoConfigurado, carregarBanco, gravarInterno, lerInterno } from "@/lib/server/db";
import { identificarPessoa, processarMensagem } from "@/lib/whatsapp";
import type { PessoaId } from "@/lib/types";
import { extrairMensagem, type Recebida } from "@/lib/whatsapp-entrada";
import {
  BOTOES_FIM,
  BOTOES_INICIO,
  comandoSessao,
  ehAtivarGrupo,
  MSG_FIM,
  MSG_GRUPO_ATIVADO,
  MSG_GRUPO_SEMPRE_ATIVO,
  MSG_INICIO,
  novaExpiracao,
  sessaoAtiva,
  type SessaoWhatsapp,
} from "@/lib/whatsapp-sessao";
import { BT } from "@/lib/whatsapp-modelos";
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
  let corpoJson: Record<string, unknown> | null = null;
  if (tipo.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData();
    recebida = { de: str(form.get("From")).replace(/^whatsapp:/, ""), nome: str(form.get("ProfileName")), texto: str(form.get("Body")), provedor: "twilio" };
  } else {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    corpoJson = body;
    recebida = extrairMensagem(body);
  }
  if (recebida === "ignorar") {
    if (corpoJson) {
      const d = (Array.isArray(corpoJson.data) ? corpoJson.data[0] : corpoJson.data) as Record<string, unknown> | undefined;
      const k = (d?.key ?? {}) as Record<string, unknown>;
      const jid = String(k.remoteJid ?? "");
      console.info(
        `whatsapp: descartado na leitura — evento=${String(corpoJson.event ?? "?")} conversa=${jid.endsWith("@g.us") ? "grupo …" + jid.slice(-10, -5) : jid ? "privado" : "?"}` +
          ` proprio=${k.fromMe === true ? "sim" : "não"} tipos=[${Object.keys((d?.message ?? {}) as object).join(",")}]`,
      );
    }
    return NextResponse.json({ ok: true, ignorado: true });
  }
  if (!recebida) return NextResponse.json({ erro: "Mensagem sem texto" }, { status: 400 });

  try {
    const banco = await carregarBanco();
    const conhecida = identificarPessoa(banco, recebida.de);
    let pessoa: PessoaId = conhecida ?? "casal";
    let noGrupoFinancas = false;
    const rec = recebida;
    const grupoVinc = banco.config.grupoWhatsapp ?? "";
    const local = rec.grupo
      ? rec.responderPara === grupoVinc && grupoVinc
        ? "grupo de finanças"
        : `outro grupo …${(rec.responderPara ?? "").slice(-10, -5)}${grupoVinc ? ` (vinculado …${grupoVinc.slice(-10, -5)})` : " (nenhum vinculado)"}`
      : rec.propria
        ? "comigo mesmo"
        : "privado";
    const decidir = (corpo: Record<string, unknown>, decisao: string) => {
      if (rec.provedor === "evolution") {
        console.info(`whatsapp: ${local} · de …${rec.de.slice(-4) || "?"}${rec.lid ? " (código interno)" : ""}${rec.propria ? " (próprio número)" : ""} → ${decisao}`);
      }
      return NextResponse.json(corpo);
    };

    if (recebida.provedor === "evolution") {
      const usarBotoes = banco.config.whatsappBotoes !== false;
      const somenteGrupo = !!banco.config.whatsappSomenteGrupo;
      const ehGrupoFinancas = !!recebida.grupo && !!banco.config.grupoWhatsapp && recebida.responderPara === banco.config.grupoWhatsapp;

      // "ativar grupo": registra o grupo atual como grupo de finanças (só um de vocês pode fazer isso)
      if (recebida.grupo && ehAtivarGrupo(recebida.texto) && (conhecida || recebida.propria)) {
        await aplicarNoServidor([{ tipo: "upsert", colecao: "config", id: "config", dados: { ...banco.config, grupoWhatsapp: recebida.responderPara } }]);
        await responderEvolution(recebida, MSG_GRUPO_ATIVADO, [BT.resumo, BT.contas, BT.ajuda], usarBotoes);
        return decidir({ ok: true, grupoAtivado: true }, "grupo vinculado");
      }

      // Modo "somente o grupo de finanças": todo o resto é descartado na hora — sem resposta, sem registro.
      if (somenteGrupo && !ehGrupoFinancas) return decidir({ ok: true, ignorado: "fora do grupo de finanças" }, "ignorado (modo somente grupo)");

      if (ehGrupoFinancas) {
        noGrupoFinancas = true;
        // Grupo só de vocês dois: sempre ativo. Quem mandou: pelo número; se o WhatsApp esconder o número,
        // as mensagens do próprio robô são do dono da instância e as demais, da outra pessoa.
        const donoPessoa = identificarPessoa(banco, recebida.dono ?? "");
        const outra = donoPessoa === "p1" ? "p2" : donoPessoa === "p2" ? "p1" : "casal";
        pessoa = conhecida ?? (recebida.propria ? (donoPessoa ?? "casal") : outra);
        if (comandoSessao(recebida.texto)) {
          await responderEvolution(recebida, MSG_GRUPO_SEMPRE_ATIVO, [BT.resumo, BT.contas, BT.ajuda], usarBotoes);
          return decidir({ ok: true, grupo: "sempre ativo" }, "avisou que o grupo está sempre ativo");
        }
      } else {
        // Fora do grupo de finanças: mensagens próprias em grupos nunca são lidas.
        if (recebida.propria && recebida.grupo) return decidir({ ok: true, ignorado: "grupo não é o de finanças" }, "ignorado (mensagem própria em grupo que não é o de finanças)");
        // Só atende os números cadastrados (ou a conversa "comigo mesmo").
        if (!conhecida && !recebida.propria) {
          // guarda para aprovação em Ajustes — só conversas diretas (nunca grupos de terceiros)
          if (recebida.de && !recebida.grupo) {
            await gravarInterno("_whatsapp_recusados", recebida.de, {
              id: recebida.de,
              lid: !!recebida.lid,
              nome: recebida.nome.slice(0, 60),
              texto: recebida.texto.slice(0, 60),
              quando: new Date().toISOString(),
            });
          }
          return decidir(
            { ok: true, ignorado: "remetente desconhecido" },
            `ignorado (número não cadastrado; cadastrados: ${[banco.config.telefoneP1, banco.config.telefoneP2].map((t) => (t.replace(/\D/g, "").slice(-4) ? "…" + t.replace(/\D/g, "").slice(-4) : "")).filter(Boolean).join(", ") || "nenhum"})`,
          );
        }
        if (recebida.propria && !conhecida) pessoa = identificarPessoa(banco, recebida.de) ?? "casal";

        // Modo finanças: só lê a conversa depois de "iniciar finanças"; fora disso é conversa normal.
        const conversa = recebida.responderPara || recebida.de;
        const agora = Date.now();
        const sessao = (await lerInterno<SessaoWhatsapp>("_whatsapp_sessoes")).find((x) => x.id === conversa);
        const comando = comandoSessao(recebida.texto);
        if (comando === "iniciar") {
          await gravarInterno("_whatsapp_sessoes", conversa, { id: conversa, expira: novaExpiracao(agora) });
          await responderEvolution(recebida, MSG_INICIO, BOTOES_INICIO, usarBotoes);
          return decidir({ ok: true, sessao: "iniciada" }, "modo finanças iniciado");
        }
        if (!sessaoAtiva(sessao, agora)) return decidir({ ok: true, ignorado: "fora do modo finanças" }, "ignorado (modo finanças não iniciado)");
        if (comando === "encerrar") {
          await gravarInterno("_whatsapp_sessoes", conversa, null);
          await responderEvolution(recebida, MSG_FIM, BOTOES_FIM, usarBotoes);
          return decidir({ ok: true, sessao: "encerrada" }, "modo finanças encerrado");
        }
        await gravarInterno("_whatsapp_sessoes", conversa, { id: conversa, expira: novaExpiracao(agora) });
      }
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
    if (recebida.provedor === "evolution") {
      // no grupo de finanças não existe "encerrar" (está sempre ativo)
      const botoes = noGrupoFinancas
        ? [...new Map((r.botoes ?? []).map((bt) => (bt.id === "encerrar" ? BT.ajuda : bt)).map((bt) => [bt.id, bt])).values()]
        : r.botoes;
      respondido = await responderEvolution(recebida, r.resposta, botoes, banco.config.whatsappBotoes !== false);
    }
    return decidir({ ok: r.ok, pessoa, resposta: r.resposta, respondido }, `processado como ${pessoa}${r.ops.length ? " (lançou)" : ""}${respondido === false ? " — FALHA ao responder pela Evolution" : ""}`);
  } catch (e) {
    console.error("whatsapp", e);
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
