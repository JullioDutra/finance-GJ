import { NextResponse } from "next/server";
import { bancoConfigurado, carregarBanco } from "@/lib/server/db";

// Diagnóstico público: diz só se o banco está conectado (não expõe nenhum dado).
export async function GET(req: Request) {
  void req.url; // executa a cada requisição
  if (!bancoConfigurado()) return NextResponse.json({ banco: "nao_configurado" });
  const inicio = Date.now();
  try {
    await carregarBanco();
    return NextResponse.json({ banco: "ok", ms: Date.now() - inicio }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("saude", e);
    return NextResponse.json({ banco: "erro", detalhe: (e as Error).message.slice(0, 200) }, { status: 500 });
  }
}
