"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [credencial, setCredencial] = useState("");
  const [password,   setPassword]   = useState("");
  const [error,       setError]     = useState<string | null>(null);
  const [loading,     setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Solo se normaliza a minusculas si parece un email — un username
      // podria ser sensible a mayusculas/minusculas segun como se creo.
      const valor = credencial.trim();
      const esEmail = valor.includes("@");
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: esEmail ? valor.toLowerCase() : valor, password }),
      });

      const data = await res.json() as { message?: string };
      if (!res.ok) {
        setError(data.message ?? "Credenciales inválidas");
        return;
      }

      router.push("/lotes");
      router.refresh();
    } catch {
      setError("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">Email o usuario</label>
        <input
          id="email"
          type="text"
          className="input"
          value={credencial}
          onChange={(e) => setCredencial(e.target.value)}
          autoComplete="username"
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="password">Contraseña</label>
        <input
          id="password"
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
        {loading ? "Ingresando..." : "Ingresar"}
      </button>

      <div className="mt-4 p-3 bg-verde-50 rounded-lg text-xs text-gray-500 space-y-0.5">
        <p className="font-medium text-gray-600">Cuentas demo:</p>
        <p>admin@agrochain.co · <span className="font-mono">admin123</span></p>
        <p>agricultor@agrochain.co · <span className="font-mono">12345678-</span></p>
      </div>
    </form>
  );
}
