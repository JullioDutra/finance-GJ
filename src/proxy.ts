import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESSAO, sessaoValida } from "./lib/server/auth";

// Protege o app com o PIN (APP_PIN). Rotas públicas: login, webhook do WhatsApp e arquivos do PWA.
export async function proxy(req: NextRequest) {
  const ok = await sessaoValida(req.cookies.get(COOKIE_SESSAO)?.value);
  if (ok) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!login|api/login|api/passkey/login|api/whatsapp|api/bom-dia|api/estudo|api/saude|_next/static|_next/image|favicon.ico|icon.png|manifest.webmanifest|sw.js|icons/).*)",
  ],
};
