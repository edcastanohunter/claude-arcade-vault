"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const INITIAL_ERRORS = {
  confirm: "No se pudo confirmar tu correo. El enlace puede haber caducado; intenta registrarte de nuevo.",
  auth: "No se pudo completar el inicio de sesión. Inténtalo otra vez.",
};

export default function Auth({ initialError }: { initialError?: keyof typeof INITIAL_ERRORS }) {
  const router = useRouter();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(initialError ? INITIAL_ERRORS[initialError] : null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    if (tab === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      setLoading(false);
      if (error) return setError(error.message);
      router.push("/");
      router.refresh();
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
          data: { display_name: user },
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });
      setLoading(false);
      if (error) return setError(error.message);
      setSent(true);
    }
  };

  const signInWithGoogle = async () => {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  };

  const playAsGuest = () => router.push("/");

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.16em", marginTop: 6 }}>
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button className={tab === "in" ? "on" : ""} onClick={() => { setTab("in"); setError(null); setSent(false); }}>
            INICIAR SESIÓN
          </button>
          <button className={tab === "up" ? "on" : ""} onClick={() => { setTab("up"); setError(null); setSent(false); }}>
            CREAR CUENTA
          </button>
        </div>

        {sent ? (
          <div className="slide-in" style={{ textAlign: "center", padding: "20px 0" }}>
            <div className="pixel neon-green" style={{ fontSize: 12, marginBottom: 12 }}>
              REVISA TU CORREO
            </div>
            <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>
              Te enviamos un enlace a <b>{email}</b> para confirmar la cuenta.
            </p>
          </div>
        ) : (
          <form onSubmit={submit}>
            {tab === "up" && (
              <div className="field slide-in">
                <label>Usuario</label>
                <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="px_kai" maxLength={10} />
              </div>
            )}
            <div className="field">
              <label>Correo electrónico</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jugador@vault.gg"
              />
            </div>
            <div className="field">
              <label>Contraseña</label>
              <input
                type="password"
                required
                minLength={6}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div role="alert" style={{ color: "var(--magenta)", fontSize: 12, marginTop: 4 }}>
                {error}
              </div>
            )}

            <button className="btn lg" type="submit" disabled={loading} style={{ width: "100%", marginTop: 8 }}>
              {tab === "in" ? "ENTRAR AL VAULT" : "CREAR Y JUGAR"}
            </button>
          </form>
        )}

        <button className="btn ghost" style={{ width: "100%", marginTop: 10 }} onClick={playAsGuest}>
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social" style={{ gridTemplateColumns: "1fr" }}>
          <button className="btn ghost" type="button" onClick={signInWithGoogle}>
            ◆ GOOGLE
          </button>
        </div>

        <div style={{ marginTop: 18, textAlign: "center", fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.1em" }}>
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
