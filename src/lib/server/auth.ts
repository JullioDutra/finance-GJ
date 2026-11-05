// Login simples por PIN compartilhado (vocês dois usam o mesmo).
// Funciona tanto no proxy quanto nas rotas (usa Web Crypto).

export const COOKIE_SESSAO = "gj_sessao";

export function pinConfigurado(): boolean {
  return !!process.env.APP_PIN;
}

export async function tokenSessao(): Promise<string> {
  const base = `gj:${process.env.APP_PIN ?? ""}:${process.env.APP_SECRET ?? "segredo-padrao-troque"}`;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(base));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sessaoValida(cookie: string | undefined): Promise<boolean> {
  if (!pinConfigurado()) return true;
  if (!cookie) return false;
  return cookie === (await tokenSessao());
}

export const OPCOES_COOKIE_SESSAO = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 400, // ~13 meses: fica conectado
};

async function hmac(texto: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`gj-hmac:${process.env.APP_SECRET ?? "segredo-padrao-troque"}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Assina um valor curto (ex.: desafio do passkey) para guardar num cookie. */
export async function assinar(valor: string): Promise<string> {
  return `${valor}.${await hmac(valor)}`;
}

export async function verificarAssinado(assinado: string | undefined): Promise<string | null> {
  if (!assinado) return null;
  const i = assinado.lastIndexOf(".");
  if (i <= 0) return null;
  const valor = assinado.slice(0, i);
  return (await hmac(valor)) === assinado.slice(i + 1) ? valor : null;
}
