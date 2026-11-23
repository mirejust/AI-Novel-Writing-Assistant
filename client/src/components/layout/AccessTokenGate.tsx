import { useEffect, useState, type ReactNode } from "react";
import { API_BASE_URL } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AccessTokenGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "ready" | "required">("checking");
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function connect(accessToken?: string, signal?: AbortSignal) {
    setBusy(true);
    try {
      const response = await fetch(`${API_BASE_URL}/access/session`, {
        method: accessToken ? "POST" : "GET", credentials: "include", cache: "no-store", signal,
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      if (response.ok) { setToken(""); setState("ready"); setMessage(""); }
      else { setState("required"); setMessage((await response.json()).error ?? "La conexión falló, vuelva a ingresar el token de acceso."); }
    } catch (error) {
      if (!signal?.aborted) { setState("required"); setMessage("No se puede conectar al servicio de creación. Verifique la dirección e inténtelo nuevamente."); }
    } finally { setBusy(false); }
  }
  useEffect(() => {
    const controller = new AbortController();
    void connect(undefined, controller.signal);
    const requireAccess = () => { setState("required"); setMessage("Introduzca un token de acceso válido."); };
    window.addEventListener("ai-novel:access-required", requireAccess);
    return () => { controller.abort(); window.removeEventListener("ai-novel:access-required", requireAccess); };
  }, []);
  if (state === "ready") return children;
  return <main className="flex min-h-dvh items-center justify-center bg-background p-6">
    <form className="w-full max-w-sm space-y-4" onSubmit={event => { event.preventDefault(); void connect(token.trim()); }}>
      <h1 className="text-xl font-semibold">Conéctese a su banco de trabajo de escritura</h1>
      {state === "checking" ? <p role="status">Conectándose a servicios de creación...</p> : <>
        <p className="text-sm text-muted-foreground">Ingrese el token de acceso proporcionado por su implementador, vea la novela y continúe creando.</p>
        <label className="block space-y-2 text-sm">Token de acceso<Input autoComplete="current-password" type="password" required value={token} onChange={event => setToken(event.target.value)} /></label>
        {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
        <Button disabled={busy} type="submit">{busy ? "Conectando…" : "Conectar banco de trabajo"}</Button>
      </>}
    </form>
  </main>;
}
