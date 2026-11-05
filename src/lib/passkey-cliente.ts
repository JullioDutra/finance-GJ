"use client";

import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable, startAuthentication, startRegistration } from "@simplewebauthn/browser";

export const CHAVE_TEM_DIGITAL = "gj-tem-digital";
export const CHAVE_NAO_PERGUNTAR = "gj-digital-nao-perguntar";

export function lerFlag(chave: string): boolean {
  try {
    return localStorage.getItem(chave) === "1";
  } catch {
    return false;
  }
}

export function gravarFlag(chave: string, v: boolean) {
  try {
    if (v) localStorage.setItem(chave, "1");
    else localStorage.removeItem(chave);
  } catch {
    /* ignora */
  }
}

/** true se o aparelho tem digital / Face ID / Windows Hello disponível. */
export async function digitalDisponivel(): Promise<boolean> {
  if (!browserSupportsWebAuthn()) return false;
  try {
    return await platformAuthenticatorIsAvailable();
  } catch {
    return false;
  }
}

function mensagemErro(e: unknown): string {
  const nome = (e as { name?: string })?.name;
  if (nome === "NotAllowedError" || nome === "AbortError") return "Cancelado.";
  if (nome === "InvalidStateError") return "Este aparelho já está cadastrado.";
  return (e as Error)?.message || "Não foi possível usar a digital.";
}

async function post(url: string, body?: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error((json.erro as string) || "Erro");
  return json;
}

/** Cadastra a digital / Face ID deste aparelho (precisa estar logado). */
export async function cadastrarDigital(): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    const opcoes = await post("/api/passkey/registro-opcoes");
    const resposta = await startRegistration({ optionsJSON: opcoes as never });
    await post("/api/passkey/registro", { resposta });
    gravarFlag(CHAVE_TEM_DIGITAL, true);
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: mensagemErro(e) };
  }
}

/** Entra usando a digital / Face ID. */
export async function entrarComDigital(): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    const opcoes = await post("/api/passkey/login-opcoes");
    const resposta = await startAuthentication({ optionsJSON: opcoes as never });
    await post("/api/passkey/login", { resposta });
    gravarFlag(CHAVE_TEM_DIGITAL, true);
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: mensagemErro(e) };
  }
}
