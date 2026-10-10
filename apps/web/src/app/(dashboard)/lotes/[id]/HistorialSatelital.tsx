"use client";
import { useEffect, useRef, useState } from "react";
import type * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatFecha } from "@/lib/utils";

interface Escena {
  id: string;
  fecha: string;
  satellite_id: string;
  satelite: string;
  nubosidad: number | string | null;
}

interface GeoJson {
  type: string;
  coordinates: number[][][] | number[][][][];
}

const SATELITES = [
  { id: "S2", nombre: "Sentinel-2 SR (10 m)" },
  { id: "LC08", nombre: "Landsat 8 (30 m)" },
  { id: "LC09", nombre: "Landsat 9 (30 m)" },
  { id: "S1", nombre: "Sentinel-1 SAR" },
];

// Bandas por satélite para true color (B4,B3,B2 es válido en S2/LC08/LC09; S1
// usa polarizaciones). El backend de Terrasacha cae a las default si no aplican.
const BANDAS: Record<string, string> = {
  S2: "B4,B3,B2",
  LC08: "B4,B3,B2",
  LC09: "B4,B3,B2",
  S1: "VV",
};

function rangoPorDefecto(): { desde: string; hasta: string } {
  const hasta = new Date();
  const desde = new Date(hasta.getFullYear() - 1, hasta.getMonth(), hasta.getDate());
  return { desde: desde.toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10) };
}

interface Props {
  loteId: string;
  parcelaId: string;
}

// Historial satelital de la parcela del lote. Consulta EN VIVO contra Terrasacha
// a través del proxy de la API (nunca expone credenciales al browser) y muestra
// las escenas true color sobre el polígono vigente de la parcela. No se
// persiste nada: cada búsqueda va contra el proveedor.
export function HistorialSatelital({ loteId, parcelaId }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.TileLayer | null>(null);
  const poligonoLayerRef = useRef<L.GeoJSON | null>(null);
  const [mapaListo, setMapaListo] = useState(false);

  const [poligono, setPoligono] = useState<GeoJson | null>(null);
  const [sinPoligono, setSinPoligono] = useState(false);

  const [satellite, setSatellite] = useState("S2");
  const [rango, setRango] = useState(rangoPorDefecto);
  const [nubosidad, setNubosidad] = useState(20);

  const [buscando, setBuscando] = useState(false);
  const [cargandoPreview, setCargandoPreview] = useState<string | null>(null);
  const [escenas, setEscenas] = useState<Escena[]>([]);
  const [escenaActiva, setEscenaActiva] = useState<Escena | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // ── Mapa Leaflet (solo en cliente) ─────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    let map: L.Map;
    (async () => {
      const L = (await import("leaflet")).default;
      map = L.map(mapRef.current!).setView([4.6, -74.1], 12);
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      setTimeout(() => map.invalidateSize(), 100);
      setMapaListo(true);
    })();

    return () => {
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // ── Polígono vigente de la parcela (AOI) ───────────────────────────────────
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch(`/api/parcelas/${parcelaId}/poligono`);
        if (res.status === 404) {
          if (!cancelado) setSinPoligono(true);
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelado) setPoligono(data?.poligono?.geojson ?? null);
      } catch {
        // el mapa queda centrado por defecto; el error de búsqueda es el relevante
      }
    })();
    return () => { cancelado = true; };
  }, [parcelaId]);

  // Dibuja el polígono una vez el mapa y el geojson están listos.
  useEffect(() => {
    if (!mapaListo || !poligono || !mapInstanceRef.current) return;
    let cancelado = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelado || !mapInstanceRef.current) return;
      poligonoLayerRef.current?.remove();
      const capa = L.geoJSON(poligono as any, {
        style: { color: "#16a34a", weight: 3, fillOpacity: 0.05 },
        interactive: false,
      });
      capa.addTo(mapInstanceRef.current);
      poligonoLayerRef.current = capa;
      try {
        mapInstanceRef.current.fitBounds(capa.getBounds(), { maxZoom: 17 });
      } catch {
        // geometría vacía o inválida
      }
    })();
    return () => { cancelado = true; };
  }, [mapaListo, poligono]);

  // ── Búsqueda de escenas ────────────────────────────────────────────────────
  async function buscar() {
    setBuscando(true);
    setError(null);
    setAviso(null);
    setEscenaActiva(null);
    overlayRef.current?.remove();
    overlayRef.current = null;
    try {
      const qs = new URLSearchParams({
        satellite,
        desde: rango.desde,
        hasta: rango.hasta,
        nubosidad: String(nubosidad),
      });
      const res = await fetch(`/api/lotes/${loteId}/satelital?${qs.toString()}`);
      const data = await res.json();
      if (res.status === 503) {
        throw new Error("La integración satelital no está configurada en el servidor.");
      }
      if (!res.ok) {
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }
      setEscenas(data.images ?? []);
      if ((data.images ?? []).length === 0) {
        setAviso("No se encontraron escenas con esos filtros.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al buscar escenas");
      setEscenas([]);
    } finally {
      setBuscando(false);
    }
  }

  // ── Previsualización de una escena sobre el mapa ───────────────────────────
  async function previsualizar(escena: Escena) {
    setCargandoPreview(escena.id);
    setError(null);
    try {
      const qs = new URLSearchParams({
        imageId: escena.id,
        satellite: escena.satellite_id,
        bandas: BANDAS[escena.satellite_id] ?? "B4,B3,B2",
      });
      const res = await fetch(`/api/lotes/${loteId}/satelital/preview?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }
      setEscenaActiva(escena);

      const L = (await import("leaflet")).default;
      overlayRef.current?.remove();
      const capa = L.tileLayer(data.tiles, { maxZoom: 19, attribution: "Earth Engine · Terrasacha" });
      capa.addTo(mapInstanceRef.current!);
      overlayRef.current = capa;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al previsualizar la escena");
    } finally {
      setCargandoPreview(null);
    }
  }

  function limpiarOverlay() {
    overlayRef.current?.remove();
    overlayRef.current = null;
    setEscenaActiva(null);
  }

  return (
    <div>
      {/* Filtros */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="label">Satélite</label>
          <select className="input" value={satellite} onChange={(e) => setSatellite(e.target.value)}>
            {SATELITES.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Desde</label>
          <input
            type="date"
            className="input"
            value={rango.desde}
            onChange={(e) => setRango((r) => ({ ...r, desde: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Hasta</label>
          <input
            type="date"
            className="input"
            value={rango.hasta}
            onChange={(e) => setRango((r) => ({ ...r, hasta: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Nubosidad máx. (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            className="input"
            value={nubosidad}
            onChange={(e) => setNubosidad(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <button onClick={buscar} disabled={buscando} className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50">
          {buscando ? "Buscando…" : "Buscar escenas"}
        </button>
        {escenaActiva && (
          <button onClick={limpiarOverlay} className="text-xs text-gray-400 hover:text-gray-600">
            Quitar imagen
          </button>
        )}
        <span className="text-[11px] text-gray-400">Consulta en vivo · sin almacenamiento</span>
      </div>

      {/* Mapa */}
      <div ref={mapRef} className="w-full h-80 rounded-lg border border-gray-200" />

      {escenaActiva && (
        <p className="text-[11px] text-gray-500 mt-2">
          Mostrando {escenaActiva.satelite} · {formatFecha(escenaActiva.fecha)}
        </p>
      )}
      {sinPoligono && (
        <p className="text-xs text-amber-600 mt-2">
          La parcela no tiene polígono registrado. Dibújalo en el detalle de la parcela para usar el historial satelital.
        </p>
      )}
      {aviso && <p className="text-xs text-gray-400 mt-2">{aviso}</p>}
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

      {/* Lista de escenas */}
      {escenas.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            {escenas.length} escena{escenas.length === 1 ? "" : "s"} disponible{escenas.length === 1 ? "" : "s"}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
            {escenas.map((e) => (
              <button
                key={e.id}
                onClick={() => previsualizar(e)}
                disabled={cargandoPreview === e.id}
                className={`text-left p-2.5 rounded-lg border transition-colors disabled:opacity-50 ${
                  escenaActiva?.id === e.id
                    ? "border-verde-500 bg-verde-50/50"
                    : "border-gray-100 hover:border-verde-300 hover:bg-gray-50"
                }`}
              >
                <p className="text-xs font-medium text-gray-800">{formatFecha(e.fecha)}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {e.satelite}
                  {e.nubosidad != null && e.nubosidad !== "N/A" ? ` · ${e.nubosidad}% nubes` : ""}
                </p>
                {cargandoPreview === e.id && <p className="text-[10px] text-verde-600 mt-1">Cargando…</p>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}