"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { generarContentHashAporte, generarHashArchivo } from "@/lib/hashAporte";

// Metadata de campos conocidos — mismo criterio que apps/mobile/app/registrar-aporte.tsx
const OPCIONES_CAMPO: Record<string, string[]> = {
  estadoFenologico: ["Plántula", "Vegetativo", "Floración", "Fructificación", "Madurez"],
  estadoSanitario:  ["Sano", "Con plaga", "Con enfermedad", "Con deficiencia", "Requiere atención"],
};

const META_CAMPO: Record<string, { label: string; tipo: "numero" | "texto" | "seleccion"; unidad?: string; placeholder?: string }> = {
  descripcion:      { label: "Descripción", tipo: "texto", placeholder: "Observaciones del evento en campo..." },
  alturaCm:         { label: "Altura de planta", tipo: "numero", unidad: "cm", placeholder: "Ej: 120" },
  diametroTalloCm:  { label: "Diámetro de tallo", tipo: "numero", unidad: "cm", placeholder: "Ej: 4.5" },
  numHojas:         { label: "Número de hojas", tipo: "numero", placeholder: "Ej: 12" },
  estadoFenologico: { label: "Estado fenológico", tipo: "seleccion" },
  estadoSanitario:  { label: "Estado sanitario", tipo: "seleccion" },
  profundidadCm:    { label: "Profundidad de siembra", tipo: "numero", unidad: "cm", placeholder: "Ej: 5" },
};

function getMeta(campo: string) {
  return META_CAMPO[campo] ?? {
    label: campo.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim(),
    tipo: "texto" as const,
    placeholder: "Ingresa el valor...",
  };
}

interface Props {
  campanaId: string;
  plantaId: string;
  codigoPlanta: string;
  tecnicoId: string;
  posicion: number;
  camposAsignados: string[]; // ["descripcion", "foto", "audio", ...]
  siempreAbierto?: boolean; // el padre controla la visibilidad (oculta el boton "+")
  onGuardado?: () => void;
  // ADMIN: registra el aporte en nombre de otro tecnico/posicion (el backend lo valida)
  tecnicoIdOverride?: string;
  posicionOverride?: number;
}

export function RegistrarAporteTecnico({
  campanaId,
  plantaId,
  codigoPlanta,
  tecnicoId,
  posicion,
  camposAsignados,
  siempreAbierto = false,
  onGuardado,
  tecnicoIdOverride,
  posicionOverride,
}: Props) {
  const router = useRouter();
  const [abierto, setAbierto]     = useState(siempreAbierto);
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const camposDatos = camposAsignados.filter((c) => c !== "foto" && c !== "audio");
  const tieneFoto  = camposAsignados.includes("foto");
  const tieneAudio = camposAsignados.includes("audio");

  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(camposDatos.map((c) => [c, ""]))
  );

  const [gps, setGps]                 = useState<{ lat: number; lng: number } | null>(null);
  const [obteniendoGps, setObtGps]    = useState(false);

  const [fotoFile, setFotoFile]   = useState<File | null>(null);
  const [fotoHash, setFotoHash]   = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioHash, setAudioHash] = useState<string | null>(null);
  const fotoInputRef  = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  function obtenerGps() {
    if (!navigator.geolocation) return;
    setObtGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setObtGps(false);
      },
      () => setObtGps(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function handleAbrir() {
    setAbierto(true);
    if (!gps) obtenerGps();
  }

  useEffect(() => {
    if (siempreAbierto) obtenerGps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoFile(file);
    setFotoHash(await generarHashArchivo(file));
  }

  async function handleAudioChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFile(file);
    setAudioHash(await generarHashArchivo(file));
  }

  function validar(): string | null {
    for (const campo of camposDatos) {
      const meta = getMeta(campo);
      const v = valores[campo]?.trim();
      if (!v) return `El campo "${meta.label}" es obligatorio`;
      if (meta.tipo === "numero" && isNaN(parseFloat(v.replace(",", ".")))) {
        return `"${meta.label}" debe ser un número`;
      }
    }
    if (tieneFoto && !fotoFile) return "Debes adjuntar la foto de evidencia";
    if (tieneAudio && !audioFile) return "Debes adjuntar la nota de voz";
    return null;
  }

  async function handleGuardar() {
    const err = validar();
    if (err) { setError(err); return; }

    setGuardando(true);
    setError(null);
    try {
      const camposObj: Record<string, unknown> = {};
      for (const campo of camposDatos) {
        const meta = getMeta(campo);
        const v = valores[campo].trim().replace(",", ".");
        camposObj[campo] = meta.tipo === "numero" ? parseFloat(v) : v;
      }

      // El backend recalcula el hash usando el tecnico/posicion efectivos
      // (el override si el ADMIN registra en nombre de otro tecnico).
      const tecnicoEfectivo = tecnicoIdOverride ?? tecnicoId;
      const posicionEfectiva = posicionOverride ?? posicion;

      const fechaAporte = new Date().toISOString();
      const contentHash = await generarContentHashAporte({
        plantaId,
        campanaId,
        tecnicoId: tecnicoEfectivo,
        posicion: posicionEfectiva,
        campos: camposObj,
        fotoHash,
        audioHash,
        latitud: gps?.lat ?? null,
        longitud: gps?.lng ?? null,
        fechaAporte,
      });

      const body: Record<string, unknown> = {
        campos: camposObj,
        fotoHash: fotoHash ?? undefined,
        audioHash: audioHash ?? undefined,
        latitud: gps?.lat,
        longitud: gps?.lng,
        contentHash,
        fechaAporte,
        tecnicoIdOverride,
        posicionOverride,
      };

      const res = await fetch(
        `/api/campanas/${campanaId}/registros/${plantaId}/aportes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(data.message ?? `Error ${res.status}`);
      }

      if (!siempreAbierto) setAbierto(false);
      setError(null);
      onGuardado?.();
      router.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setGuardando(false);
    }
  }

  if (!abierto) {
    return (
      <button
        onClick={handleAbrir}
        className="text-xs bg-verde-500 hover:bg-verde-600 text-white font-semibold rounded-lg px-3 py-1.5 transition-colors"
      >
        {tecnicoIdOverride ? `Registrar aporte — P${posicionOverride}` : `Registrar mi aporte — P${posicion}`}
      </button>
    );
  }

  return (
    <div className={siempreAbierto ? "space-y-3" : "mt-3 rounded-lg border border-verde-200 bg-verde-50/40 p-4 space-y-3"}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-verde-800">
          Registrar aporte — P{posicion} · Planta {codigoPlanta}
        </p>
        {!siempreAbierto && (
          <button
            onClick={() => { setAbierto(false); setError(null); }}
            className="text-verde-400 hover:text-verde-600 text-sm leading-none"
          >
            ✕
          </button>
        )}
      </div>

      {/* GPS */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-500">Coordenadas GPS</label>
        <div className="flex items-center gap-2 text-xs border border-gray-200 rounded-md px-3 py-2 bg-white text-gray-500">
          {gps ? `${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}` : obteniendoGps ? "Obteniendo ubicación…" : "Sin GPS"}
          {!gps && !obteniendoGps && (
            <button onClick={obtenerGps} className="ml-auto text-verde-600 font-medium hover:underline">
              Reintentar
            </button>
          )}
        </div>
      </div>

      {/* Campos de datos */}
      {camposDatos.map((campo) => {
        const meta = getMeta(campo);
        const opciones = OPCIONES_CAMPO[campo];
        return (
          <div key={campo} className="space-y-1">
            <label className="text-xs font-medium text-gray-700">
              {meta.label}{meta.unidad ? ` (${meta.unidad})` : ""} <span className="text-red-500">*</span>
            </label>
            {opciones ? (
              <div className="flex flex-wrap gap-1.5">
                {opciones.map((op) => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => setValores((p) => ({ ...p, [campo]: op }))}
                    className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                      valores[campo] === op
                        ? "border-verde-500 bg-verde-50 text-verde-700 font-medium"
                        : "border-gray-200 bg-white text-gray-600 hover:border-verde-300"
                    }`}
                  >
                    {op}
                  </button>
                ))}
              </div>
            ) : (
              <input
                type={meta.tipo === "numero" ? "text" : "text"}
                inputMode={meta.tipo === "numero" ? "decimal" : "text"}
                value={valores[campo] ?? ""}
                onChange={(e) => setValores((p) => ({ ...p, [campo]: e.target.value }))}
                placeholder={meta.placeholder}
                className="w-full text-xs border border-gray-200 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-verde-500"
              />
            )}
          </div>
        );
      })}

      {/* Foto */}
      {tieneFoto && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">
            Evidencia fotográfica <span className="text-red-500">*</span>
          </label>
          <input
            ref={fotoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFotoChange}
            className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-verde-100 file:text-verde-700 hover:file:bg-verde-200"
          />
          {fotoFile && (
            <p className="text-[11px] text-verde-600">
              ✓ {fotoFile.name} — hash: {fotoHash?.slice(0, 16)}…
            </p>
          )}
        </div>
      )}

      {/* Audio */}
      {tieneAudio && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">
            Nota de voz <span className="text-red-500">*</span>
          </label>
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            capture
            onChange={handleAudioChange}
            className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-verde-100 file:text-verde-700 hover:file:bg-verde-200"
          />
          {audioFile && (
            <p className="text-[11px] text-verde-600">
              ✓ {audioFile.name} — hash: {audioHash?.slice(0, 16)}…
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
      )}

      <button
        onClick={handleGuardar}
        disabled={guardando}
        className="w-full bg-verde-500 hover:bg-verde-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg py-2 transition-colors"
      >
        {guardando ? "Guardando…" : "Guardar aporte"}
      </button>
    </div>
  );
}
