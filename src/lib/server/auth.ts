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
