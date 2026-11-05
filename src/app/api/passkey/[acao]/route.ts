import { NextResponse, type NextRequest } from "next/server";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { assinar, COOKIE_SESSAO, OPCOES_COOKIE_SESSAO, sessaoValida, tokenSessao, verificarAssinado } from "@/lib/server/auth";
import { bancoConfigurado, gravarInterno, lerInterno } from "@/lib/server/db";

// Entrar com digital / Face ID (passkeys / WebAuthn).
//  POST /api/passkey/registro-opcoes  (logado)  -> opções para cadastrar este aparelho
//  POST /api/passkey/registro         (logado)  -> confere e salva o passkey
//  POST /api/passkey/login-opcoes     (público) -> opções para entrar
//  POST /api/passkey/login            (público) -> confere e cria a sessão
//  GET  /api/passkey/lista            (logado)  -> aparelhos cadastrados
//  POST /api/passkey/remover          (logado)  -> remove um aparelho { id }

interface PasskeySalvo {
  id: string;
  publicKey: string; // base64url
  counter: number;
  transports?: AuthenticatorTransportFuture[];
  nome: string;
  criadoEm: string;
  ultimoUso?: string;
}

const COOKIE_DESAFIO = "gj_desafio";

function origem(req: NextRequest) {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host).split(",")[0].trim();
  const proto = (req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "")).split(",")[0].trim();
  return { rpID: host.split(":")[0], origin: `${proto}://${host}` };
}

const erro = (msg: string, status = 400) => NextResponse.json({ erro: msg }, { status });

async function comDesafio(res: NextResponse, desafio: string) {
  res.cookies.set(COOKIE_DESAFIO, await assinar(desafio), { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/api/passkey", maxAge: 300 });
  return res;
}

function nomeAparelho(ua: string): string {
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Mac OS/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  return "Aparelho";
}

export async function GET(req: NextRequest, ctx: RouteContext<"/api/passkey/[acao]">) {
  const { acao } = await ctx.params;
  if (acao !== "lista") return erro("Ação inválida", 404);
  if (!(await sessaoValida(req.cookies.get(COOKIE_SESSAO)?.value))) return erro("Não autorizado", 401);
  if (!bancoConfigurado()) return NextResponse.json({ passkeys: [] });
  const lista = await lerInterno<PasskeySalvo>("_passkeys");
  return NextResponse.json({ passkeys: lista.map(({ id, nome, criadoEm, ultimoUso }) => ({ id, nome, criadoEm, ultimoUso })) });
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/passkey/[acao]">) {
  const { acao } = await ctx.params;
  if (!bancoConfigurado()) return erro("A entrada com digital precisa do banco de dados conectado.");
  if (!process.env.APP_PIN) return erro("Defina APP_PIN para usar a entrada com digital.");
  const { rpID, origin } = origem(req);
  const logado = await sessaoValida(req.cookies.get(COOKIE_SESSAO)?.value);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    if (acao === "registro-opcoes") {
      if (!logado) return erro("Não autorizado", 401);
      const existentes = await lerInterno<PasskeySalvo>("_passkeys");
      const opcoes = await generateRegistrationOptions({
        rpName: "Finanças G&J",
        rpID,
        userName: "casal",
        userDisplayName: "Finanças G&J",
        userID: new TextEncoder().encode("financas-gj-casal"),
        attestationType: "none",
        excludeCredentials: existentes.map((p) => ({ id: p.id, transports: p.transports })),
        authenticatorSelection: { residentKey: "required", userVerification: "required" },
      });
      return comDesafio(NextResponse.json(opcoes), opcoes.challenge);
    }

    if (acao === "registro") {
      if (!logado) return erro("Não autorizado", 401);
      const desafio = await verificarAssinado(req.cookies.get(COOKIE_DESAFIO)?.value);
      if (!desafio) return erro("Tempo esgotado. Tente de novo.");
      const v = await verifyRegistrationResponse({
        response: body.resposta as RegistrationResponseJSON,
        expectedChallenge: desafio,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
      });
      if (!v.verified || !v.registrationInfo) return erro("Não foi possível confirmar a digital.");
      const c = v.registrationInfo.credential;
      const salvo: PasskeySalvo = {
        id: c.id,
        publicKey: Buffer.from(c.publicKey).toString("base64url"),
        counter: c.counter,
        transports: c.transports,
        nome: String(body.nome || nomeAparelho(req.headers.get("user-agent") ?? "")).slice(0, 60),
        criadoEm: new Date().toISOString(),
      };
      await gravarInterno("_passkeys", salvo.id, salvo);
      const res = NextResponse.json({ ok: true });
      res.cookies.delete({ name: COOKIE_DESAFIO, path: "/api/passkey" });
      return res;
    }

    if (acao === "login-opcoes") {
      const opcoes = await generateAuthenticationOptions({ rpID, userVerification: "required" });
      return comDesafio(NextResponse.json(opcoes), opcoes.challenge);
    }

    if (acao === "login") {
      const desafio = await verificarAssinado(req.cookies.get(COOKIE_DESAFIO)?.value);
      if (!desafio) return erro("Tempo esgotado. Tente de novo.");
      const resposta = body.resposta as AuthenticationResponseJSON;
      const salvos = await lerInterno<PasskeySalvo>("_passkeys");
      const p = salvos.find((x) => x.id === resposta?.id);
      if (!p) return erro("Este aparelho não está cadastrado. Entre com o PIN e ative a digital.", 401);
      const v = await verifyAuthenticationResponse({
        response: resposta,
        expectedChallenge: desafio,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
        credential: { id: p.id, publicKey: new Uint8Array(Buffer.from(p.publicKey, "base64url")), counter: p.counter, transports: p.transports },
      });
      if (!v.verified) return erro("Digital não confirmada.", 401);
      await gravarInterno("_passkeys", p.id, { ...p, counter: v.authenticationInfo.newCounter, ultimoUso: new Date().toISOString() });
      const res = NextResponse.json({ ok: true });
      res.cookies.set(COOKIE_SESSAO, await tokenSessao(), OPCOES_COOKIE_SESSAO);
      res.cookies.delete({ name: COOKIE_DESAFIO, path: "/api/passkey" });
      return res;
    }

    if (acao === "remover") {
      if (!logado) return erro("Não autorizado", 401);
      if (typeof body.id !== "string") return erro("Informe o id");
      await gravarInterno("_passkeys", body.id, null);
      return NextResponse.json({ ok: true });
    }
  } catch (e) {
    console.error("passkey", acao, e);
    return erro((e as Error).message || "Erro na digital", 400);
  }
  return erro("Ação inválida", 404);
}
