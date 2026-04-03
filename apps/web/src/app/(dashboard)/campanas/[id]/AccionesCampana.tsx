"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl } from "@/lib/client";

function getToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)ac_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

// ── Botón: ACTIVA → ABIERTA ───────────────────────────────────────────────────

export function AbrirCampanaBtn({ campanaId }: { campanaId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const router = useRouter();

  async function handleAbrir() {
    if (!confirm("¿Abrir la campaña? Los técnicos podrán empezar a registrar aportes desde la app móvil.")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/campanas/${campanaId}/estado`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ estado: "ABIERTA" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      router.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleAbrir}
        disabled={loading}
        className="w-full px-4 py-2.5 bg-verde-500 hover:bg-verde-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? "Abriendo…" : "Abrir campaña"}
      </button>
      {error && (
        <p className="text-xs text-red-600 mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}

// ── Botón: cerrar campaña (con confirmación si hay incompletos/adulterados) ────

export function CerrarCampanaBtn({
  campanaId,
  hayIncompletos,
  hayAdulterados,
}: {
  campanaId: string;
  hayIncompletos: boolean;
  hayAdulterados: boolean;
}) {
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [resumen, setResumen]       = useState<string | null>(null);
  const router = useRouter();

  const requiereConfirmacion = hayIncompletos || hayAdulterados;

  async function handleCerrar(forzar = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/campanas/${campanaId}/estado`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ estado: "CERRADA", forzar }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);

      // El servidor puede responder con requiereConfirmacion: true
      if (data.requiereConfirmacion) {
        setResumen(data.resumen ?? "Hay registros incompletos o adulterados.");
        setConfirmando(true);
        setLoading(false);
        return;
      }

      router.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  // Vista de confirmación para cierre con advertencia
  if (confirmando) {
    return (
      <div className="space-y-3">
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-3 text-xs text-amber-700">
          <p className="font-semibold mb-1.5">⚠ Cerrar con advertencia</p>
          <p className="whitespace-pre-line leading-relaxed">{resumen}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirmando(false)}
            className="flex-1 px-3 py-2 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => handleCerrar(true)}
            disabled={loading}
            className="flex-1 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? "Cerrando…" : "Cerrar con advertencia"}
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => handleCerrar(false)}
        disabled={loading}
        className={`w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
          requiereConfirmacion
            ? "bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100"
            : "bg-gray-900 hover:bg-gray-800 text-white"
        }`}
      >
        {loading ? "Cerrando…" : requiereConfirmacion ? "Cerrar con advertencia…" : "Cerrar campaña"}
      </button>
      {error && (
        <p className="text-xs text-red-600 mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}

// ── Botón verificar integridad ────────────────────────────────────────────────

export function VerificarIntegridadBtn({ campanaId, onVerificado }: { campanaId: string; onVerificado?: () => void }) {
  const [loading, setLoading]     = useState(false);
  const [resultado, setResultado] = useState<{
    ok: boolean;
    mensaje: string;
    adulteracionesDetectadas: Array<{ plantaId: string; tecnicoId: string; motivo: string }>;
  } | null>(null);
  const router = useRouter();

  async function handleVerificar() {
    setLoading(true);
    setResultado(null);
    try {
      const res = await fetch(`/api/campanas/${campanaId}/verificar-integridad`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      setResultado(data);
      onVerificado?.();
      router.refresh();
    } catch (e) {
      setResultado({ ok: false, mensaje: String(e), adulteracionesDetectadas: [] });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleVerificar}
        disabled={loading}
        className="w-full px-4 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? "Verificando…" : "Verificar integridad"}
      </button>
      {resultado && (
        <div className={`rounded-lg px-3 py-2.5 text-xs border ${
          resultado.ok
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          <p className="font-semibold mb-1">
            {resultado.ok ? "✓ Integridad OK" : "⚠ Adulteraciones detectadas"}
          </p>
          <p>{resultado.mensaje}</p>
          {resultado.adulteracionesDetectadas.length > 0 && (
            <ul className="mt-2 space-y-1">
              {resultado.adulteracionesDetectadas.map((a, i) => (
                <li key={i} className="font-mono text-[10px] bg-red-100 rounded px-2 py-1">
                  Planta: {a.plantaId.slice(-8)} · {a.motivo}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Botón verificar hash de campaña ──────────────────────────────────────────

export function VerificarHashCampanaBtn({ campanaId, onVerificado }: { campanaId: string; onVerificado?: () => void }) {
  const [loading, setLoading]     = useState(false);
  const [resultado, setResultado] = useState<{
    ok: boolean;
    mensaje: string;
    hashGuardado: string;
    hashRecalculado: string;
    totalRegistros: number;
  } | null>(null);
  const [expandido, setExpandido] = useState(false);

  async function handleVerificar() {
    setLoading(true);
    setResultado(null);
    try {
      const res = await fetch(`/api/campanas/${campanaId}/verificar-hash-campana`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      setResultado(data);
      setExpandido(false);
      onVerificado?.();
    } catch (e) {
      setResultado({
        ok: false,
        mensaje: String(e),
        hashGuardado: "",
        hashRecalculado: "",
        totalRegistros: 0,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleVerificar}
        disabled={loading}
        className="w-full px-4 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? "Verificando hash…" : "Verificar hash de campaña"}
      </button>
      {resultado && (
        <div className={`rounded-lg px-3 py-2.5 text-xs border space-y-2 ${
          resultado.ok
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          <p className="font-semibold">
            {resultado.ok ? "✓ Hash de campaña válido" : "⚠ Hash de campaña NO coincide"}
          </p>
          <p>{resultado.mensaje}</p>
          {resultado.hashGuardado && (
            <button
              onClick={() => setExpandido(!expandido)}
              className="text-[10px] underline opacity-70 hover:opacity-100"
            >
              {expandido ? "Ocultar hashes" : "Ver hashes"}
            </button>
          )}
          {expandido && (
            <div className="space-y-1.5 pt-1 border-t border-current/20">
              <div>
                <p className="opacity-60 mb-0.5">Hash sellado al cierre:</p>
                <p className="font-mono break-all text-[10px]">{resultado.hashGuardado}</p>
              </div>
              <div>
                <p className="opacity-60 mb-0.5">Hash recalculado ({resultado.totalRegistros} registros):</p>
                <p className="font-mono break-all text-[10px]">{resultado.hashRecalculado}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Panel asignar técnico a posición ─────────────────────────────────────────

export function AsignarTecnicoBtn({
  campanaId,
  posicionesFaltantes,
  camposRequeridos: _camposRequeridos,
}: {
  campanaId: string;
  posicionesFaltantes: number[];
  camposRequeridos: string[];
}) {
  const [abierto, setAbierto]         = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [posicion, setPosicion]       = useState<number>(posicionesFaltantes[0] ?? 1);
  const [tecnicoId, setTecnicoId]     = useState("");
  const [camposInput, setCamposInput] = useState("");
  const [tecnicos, setTecnicos]       = useState<Array<{ id: string; nombres: string; apellidos: string }>>([]);
  const [cargandoTec, setCargandoTec] = useState(false);
  const router = useRouter();

  async function cargarTecnicos() {
    if (tecnicos.length > 0) return;
    setCargandoTec(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/usuarios?rol=TECNICO`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setTecnicos(data.usuarios ?? []);
      if (data.usuarios?.length > 0) setTecnicoId(data.usuarios[0].id);
    } catch { /* ignore */ }
    finally { setCargandoTec(false); }
  }

  function handleAbrir() {
    setAbierto(true);
    cargarTecnicos();
  }

  async function handleAsignar(e: React.FormEvent) {
    e.preventDefault();
    if (!tecnicoId) { setError("Selecciona un técnico."); return; }
    const campos = camposInput
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    if (campos.length === 0) { setError("Ingresa al menos un campo para la posición."); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/campanas/${campanaId}/tecnicos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ posicion, tecnicoId, camposAsignados: campos }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      setAbierto(false);
      setCamposInput("");
      router.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  // Sugerencias de campos por posición
  const SUGERENCIAS: Record<number, string> = {
    1: "descripcion, foto, audio",
    2: "alturaCm, diametroTalloCm, numHojas, foto, audio",
    3: "estadoFenologico, estadoSanitario, foto, audio",
    4: "profundidadCm, foto, audio",
  };

  if (!abierto) {
    return (
      <button
        onClick={handleAbrir}
        className="w-full px-3 py-2 border border-dashed border-verde-300 text-verde-600 hover:bg-verde-50 text-xs font-medium rounded-lg transition-colors"
      >
        + Asignar técnico a posición
      </button>
    );
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">Asignar técnico</p>
        <button onClick={() => setAbierto(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
      </div>

      <form onSubmit={handleAsignar} className="space-y-3">
        {/* Posición */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Posición</label>
          <div className="flex gap-1.5">
            {posicionesFaltantes.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => { setPosicion(p); setCamposInput(SUGERENCIAS[p] ?? ""); }}
                className={`w-9 h-9 rounded-lg text-xs font-bold border transition-colors ${
                  posicion === p
                    ? "bg-verde-500 border-verde-500 text-white"
                    : "bg-white border-gray-200 text-gray-600 hover:border-verde-300"
                }`}
              >
                P{p}
              </button>
            ))}
          </div>
          {SUGERENCIAS[posicion] && (
            <p className="text-[10px] text-gray-400 mt-1">
              Sugerido: {SUGERENCIAS[posicion]}
            </p>
          )}
        </div>

        {/* Técnico */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Técnico</label>
          {cargandoTec ? (
            <p className="text-xs text-gray-400">Cargando técnicos…</p>
          ) : (
            <select
              value={tecnicoId}
              onChange={(e) => setTecnicoId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-verde-400"
            >
              <option value="">-- selecciona --</option>
              {tecnicos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombres} {t.apellidos}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Campos asignados */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">
            Campos asignados <span className="font-normal text-gray-400">(separados por coma)</span>
          </label>
          <input
            type="text"
            value={camposInput}
            onChange={(e) => setCamposInput(e.target.value)}
            placeholder="Ej: alturaCm, foto, audio"
            className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-verde-400"
          />
        </div>

        {error && (
          <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-verde-500 hover:bg-verde-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? "Asignando…" : "Asignar"}
        </button>
      </form>
    </div>
  );
}
