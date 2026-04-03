"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl } from "@/lib/client";

function getToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)ac_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

interface Props {
  campanaId: string;
  plantaId: string;
  codigoPlanta: string;
  tecnico: { id: string; nombres: string; apellidos: string };
  posicion: number;
  camposAsignados: string[]; // ["descripcion", "foto", "audio", ...]
}

export function RegistrarAporteFaltante({
  campanaId,
  plantaId,
  codigoPlanta,
  tecnico,
  posicion,
  camposAsignados,
}: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Campos de datos (excluir foto/audio — se marcarán como ausentes)
  const camposDatos = camposAsignados.filter((c) => c !== "foto" && c !== "audio");
  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(camposDatos.map((c) => [c, ""]))
  );
  const [motivo, setMotivo] = useState("");

  async function handleGuardar() {
    if (!motivo.trim()) {
      setError("Ingresa el motivo del registro manual (obligatorio para auditoría).");
      return;
    }
    for (const campo of camposDatos) {
      if (!valores[campo]?.trim()) {
        setError(`El campo "${campo}" es obligatorio.`);
        return;
      }
    }

    setGuardando(true);
    setError(null);
    try {
      const camposObj: Record<string, unknown> = {};
      for (const campo of camposDatos) {
        camposObj[campo] = valores[campo].trim();
      }
      // Siempre añadir nota de registro manual para auditoría
      const notaManual = `[Reg. manual ADMIN: ${motivo}]`;
      if (camposObj.descripcion) {
        camposObj.descripcion = `${camposObj.descripcion} ${notaManual}`;
      } else {
        camposObj.descripcion = notaManual;
      }

      const res = await fetch(
        `${getApiUrl()}/api/campanas/${campanaId}/registros/${plantaId}/aportes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            campos: camposObj,
            contentHash: `manual_admin_${Date.now()}`,
            fechaAporte: new Date().toISOString(),
            tecnicoIdOverride: tecnico.id,
            posicionOverride: posicion,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(data.message ?? `Error ${res.status}`);
      }

      setAbierto(false);
      router.refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setGuardando(false);
    }
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="text-[11px] text-amber-600 hover:text-amber-700 font-medium underline underline-offset-2"
      >
        + Registrar manualmente
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-amber-800">
          Registro manual — P{posicion} · {tecnico.nombres} {tecnico.apellidos}
        </p>
        <button
          onClick={() => { setAbierto(false); setError(null); }}
          className="text-amber-400 hover:text-amber-600 text-sm leading-none"
        >
          ✕
        </button>
      </div>
      <p className="text-[11px] text-amber-600">
        Planta: <span className="font-mono font-semibold">{codigoPlanta}</span>
        {" · "}Solo usar cuando el técnico no puede sincronizar desde la app.
      </p>

      {/* Motivo obligatorio para auditoría */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-amber-800">
          Motivo del registro manual <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej: App del técnico no sincroniza — datos verificados en campo"
          className="w-full text-xs border border-amber-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-amber-500"
        />
      </div>

      {/* Campos de datos */}
      {camposDatos.map((campo) => (
        <div key={campo} className="space-y-1">
          <label className="text-xs font-medium text-amber-800">
            {campo} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={valores[campo] ?? ""}
            onChange={(e) => setValores((p) => ({ ...p, [campo]: e.target.value }))}
            placeholder={`Valor para ${campo}`}
            className="w-full text-xs border border-amber-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-amber-500"
          />
        </div>
      ))}

      {camposAsignados.includes("foto") && (
        <p className="text-[11px] text-amber-600 bg-amber-100 rounded px-2 py-1">
          ⚠ La posición {posicion} requiere foto — el registro manual no incluirá evidencia fotográfica.
        </p>
      )}
      {camposAsignados.includes("audio") && (
        <p className="text-[11px] text-amber-600 bg-amber-100 rounded px-2 py-1">
          ⚠ La posición {posicion} requiere audio — el registro manual no incluirá nota de voz.
        </p>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
      )}

      <button
        onClick={handleGuardar}
        disabled={guardando}
        className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg py-2 transition-colors"
      >
        {guardando ? "Registrando..." : "Registrar aporte"}
      </button>
    </div>
  );
}
