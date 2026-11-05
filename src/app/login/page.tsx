"use client";

import { useState } from "react";
import { Botao, Input } from "@/components/ui";

export default function Login() {
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro("");
    const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) });
    if (res.ok) window.location.href = "/";
    else {
      setErro("PIN incorreto");
      setCarregando(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <form onSubmit={entrar} className="w-full max-w-xs space-y-4 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand text-xl font-semibold text-brand-ink">G&J</div>
        <h1 className="text-xl font-semibold">Finanças G&J</h1>
        <p className="text-sm text-muted">Digite o PIN de vocês para entrar</p>
        <Input type="password" inputMode="numeric" autoFocus value={pin} onChange={(e) => setPin(e.target.value)} className="text-center text-2xl tracking-[0.5em]" />
        {erro && <p className="text-sm text-danger">{erro}</p>}
        <Botao type="submit" className="w-full" disabled={carregando || !pin}>
          {carregando ? "Entrando…" : "Entrar"}
        </Botao>
      </form>
    </main>
  );
}
