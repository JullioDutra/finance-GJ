"use client";

import { useEffect, useState } from "react";
import { Botao, Input } from "@/components/ui";
import { CHAVE_NAO_PERGUNTAR, CHAVE_TEM_DIGITAL, cadastrarDigital, digitalDisponivel, entrarComDigital, gravarFlag, lerFlag } from "@/lib/passkey-cliente";

type Etapa = "pin" | "oferecer-digital";

export default function Login() {
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [temDigital, setTemDigital] = useState(false); // aparelho suporta
  const [jaCadastrou] = useState(() => typeof window !== "undefined" && lerFlag(CHAVE_TEM_DIGITAL));
  const [etapa, setEtapa] = useState<Etapa>("pin");

  useEffect(() => {
    digitalDisponivel().then(setTemDigital);
  }, []);

  const irParaApp = () => window.location.replace("/");

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro("");
    const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) });
    if (!res.ok) {
      setErro("PIN incorreto");
      setCarregando(false);
      return;
    }
    // logou: oferece cadastrar a digital neste aparelho (uma vez)
    if (temDigital && !lerFlag(CHAVE_TEM_DIGITAL) && !lerFlag(CHAVE_NAO_PERGUNTAR)) {
      setCarregando(false);
      setEtapa("oferecer-digital");
      return;
    }
    irParaApp();
  }

  async function digital() {
    setCarregando(true);
    setErro("");
    const r = await entrarComDigital();
    if (r.ok) return irParaApp();
    setErro(r.erro);
    setCarregando(false);
  }

  async function ativarDigital() {
    setCarregando(true);
    setErro("");
    const r = await cadastrarDigital();
    if (r.ok) return irParaApp();
    setErro(r.erro);
    setCarregando(false);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-xs space-y-4 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand text-xl font-semibold text-brand-ink">G&J</div>
        <h1 className="text-xl font-semibold">Finanças G&J</h1>

        {etapa === "oferecer-digital" ? (
          <div className="space-y-3">
            <div className="text-4xl">🔐</div>
            <p className="text-sm">
              Quer entrar com <strong>digital / Face ID</strong> nas próximas vezes neste aparelho?
            </p>
            {erro && <p className="text-sm text-danger">{erro}</p>}
            <Botao className="w-full" onClick={ativarDigital} disabled={carregando}>
              {carregando ? "Aguardando…" : "Ativar digital / Face ID"}
            </Botao>
            <Botao
              variante="fantasma"
              className="w-full"
              onClick={() => {
                gravarFlag(CHAVE_NAO_PERGUNTAR, true);
                irParaApp();
              }}
            >
              Agora não
            </Botao>
            <p className="text-xs text-muted">Dá para ativar depois em Ajustes → Acesso.</p>
          </div>
        ) : (
          <>
            {temDigital && (
              <Botao className="w-full py-3.5 text-base" onClick={digital} disabled={carregando} variante={jaCadastrou ? "primario" : "secundario"}>
                🔐 Entrar com digital / Face ID
              </Botao>
            )}
            <form onSubmit={entrar} className="space-y-3">
              {temDigital && <p className="text-xs text-muted">ou digite o PIN</p>}
              {!temDigital && <p className="text-sm text-muted">Digite o PIN de vocês para entrar</p>}
              {/* nome de usuário oculto: ajuda o celular a oferecer "salvar senha" */}
              <input type="text" name="username" autoComplete="username" value="casal" readOnly hidden />
              <Input
                type="password"
                name="password"
                autoComplete="current-password"
                inputMode="numeric"
                autoFocus={!jaCadastrou}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="text-center text-2xl tracking-[0.5em]"
                aria-label="PIN"
              />
              {erro && <p className="text-sm text-danger">{erro}</p>}
              <Botao type="submit" className="w-full" disabled={carregando || !pin} variante={jaCadastrou && temDigital ? "secundario" : "primario"}>
                {carregando ? "Entrando…" : "Entrar"}
              </Botao>
            </form>
            <p className="text-xs text-muted">Vocês ficam conectados neste aparelho por 1 ano.</p>
          </>
        )}
      </div>
    </main>
  );
}
