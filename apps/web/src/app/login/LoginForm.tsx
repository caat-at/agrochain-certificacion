"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [email,    setEmail]    = useState("agricultor@agrochain.co");
  const [password, setPassword] = useState("password123");
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
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
        <label className="label" htmlFor="email">Correo electrónico</label>
        <input
          id="email"
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
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
        <p>agricultor@agrochain.co · admin@agrochain.co</p>
        <p>Contraseña: <span className="font-mono">password123</span></p>
      </div>
    </form>
  );
}
