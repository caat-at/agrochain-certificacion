"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

interface Poligono {
  geojson: { type: string; coordinates: number[][][] };
  areaHaCalculada: number | null;
  fuente: string;
  version: number;
}

interface CapaReferencia {
  geojson: { type: string; coordinates: number[][][] };
  color: string;
  etiqueta?: string;
}

interface Props {
  // Endpoint proxy del recurso: /api/predios/:id/poligono o /api/parcelas/:id/poligono
  endpoint: string;
  centroLat: number;
  centroLon: number;
  poligonoInicial: Poligono | null;
  // Color del trazo/relleno — azul para predio, rojo para parcela, etc.
  // Distingue visualmente a que entidad pertenece cada poligono en el mapa.
  color?: string;
  // Poligonos de referencia de solo lectura (ej. el predio padre y/o las
  // demas parcelas hermanas) — se dibujan de fondo, sin controles de edicion,
  // cada uno con su propio color, para ubicar el poligono propio en contexto.
  capasReferencia?: CapaReferencia[];
  // Sin controles de dibujo/edicion ni botones de guardar/eliminar — solo
  // muestra el poligono vigente. Usado donde el poligono es informativo (ej.
  // modulo EUDR), y la edicion real vive en el detalle de la parcela/predio.
  soloLectura?: boolean;
}

// Mapa interactivo (Leaflet + leaflet-draw) para dibujar/editar el poligono
// georreferenciado de un predio o parcela. Carga dinamica sin SSR porque
// Leaflet depende de `window`.
export default function PoligonoMapa({
  endpoint,
  centroLat,
  centroLon,
  poligonoInicial,
  color = "#3388ff",
  capasReferencia = [],
  soloLectura = false,
}: Props) {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const drawnLayerRef = useRef<L.FeatureGroup | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [eliminadoOk, setEliminadoOk] = useState(false);
  const [tieneDibujo, setTieneDibujo] = useState(!!poligonoInicial);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    let map: L.Map;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet-draw");

      // Fix de iconos default de Leaflet con bundlers (Next.js no resuelve bien las rutas relativas)
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      map = L.map(mapRef.current!).setView([centroLat, centroLon], 16);
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const drawnItems = new L.FeatureGroup();
      drawnLayerRef.current = drawnItems;
      map.addLayer(drawnItems);

      // Capas de referencia (ej. poligono del predio padre y/o parcelas
      // hermanas) — no editables, solo guia visual, cada una con su color.
      const grupoReferencia = new L.FeatureGroup();
      for (const ref of capasReferencia) {
        if (!ref.geojson?.coordinates) continue;
        const capa = L.geoJSON(ref.geojson as any, {
          style: { color: ref.color, weight: 2, dashArray: "6 4", fillOpacity: 0.05 },
          interactive: false,
        });
        if (ref.etiqueta) {
          capa.bindTooltip(ref.etiqueta, { permanent: false, direction: "center" });
        }
        capa.addTo(map);
        grupoReferencia.addLayer(capa);
      }

      if (poligonoInicial?.geojson?.coordinates) {
        const capa = L.geoJSON(poligonoInicial.geojson as any, { style: { color, weight: 3 } });
        capa.eachLayer((l) => drawnItems.addLayer(l));
        try {
          map.fitBounds(drawnItems.getBounds(), { maxZoom: 18 });
        } catch {
          // poligono vacio o invalido — se mantiene la vista centrada en lat/lon
        }
      } else if (grupoReferencia.getLayers().length > 0) {
        // Sin poligono propio aun — encuadra las referencias para que el
        // usuario vea el contexto completo antes de empezar a dibujar.
        try {
          map.fitBounds(grupoReferencia.getBounds(), { maxZoom: 17 });
        } catch {
          // referencias vacias o invalidas — se mantiene la vista centrada en lat/lon
        }
      }

      if (!soloLectura) {
        const drawControl = new (L as any).Control.Draw({
          draw: {
            polygon: { allowIntersection: false, showArea: true, shapeOptions: { color, weight: 3 } },
            polyline: false,
            circle: false,
            rectangle: false,
            marker: false,
            circlemarker: false,
          },
          edit: { featureGroup: drawnItems, remove: true },
        });
        map.addControl(drawControl);

        map.on((L as any).Draw.Event.CREATED, (e: any) => {
          drawnItems.clearLayers(); // un solo poligono vigente a la vez
          drawnItems.addLayer(e.layer);
          setTieneDibujo(true);
          setGuardadoOk(false);
        });
        map.on((L as any).Draw.Event.EDITED, () => {
          setTieneDibujo(drawnItems.getLayers().length > 0);
          setGuardadoOk(false);
        });
        map.on((L as any).Draw.Event.DELETED, () => {
          setTieneDibujo(drawnItems.getLayers().length > 0);
          setGuardadoOk(false);
        });
      }

      // El contenedor puede no tener su alto final asignado todavia cuando
      // Leaflet mide el tamano (navegacion client-side entre paginas, fuentes
      // cargando, etc.) — sin esto el mapa queda en blanco (tamano 0x0).
      setTimeout(() => map.invalidateSize(), 100);
      const resizeObserver = new ResizeObserver(() => map.invalidateSize());
      resizeObserver.observe(mapRef.current!);
      resizeObserverRef.current = resizeObserver;
    })();

    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardar() {
    const drawnItems = drawnLayerRef.current;
    if (!drawnItems || drawnItems.getLayers().length === 0) {
      setError("Dibuja un polígono antes de guardar");
      return;
    }
    setGuardando(true);
    setError(null);
    setGuardadoOk(false);
    try {
      const geojson = drawnItems.toGeoJSON();
      const feature = geojson.features[0];
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geojson: feature.geometry, fuente: "DIBUJADO_MANUAL" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? "Error al guardar el polígono");
      }
      setGuardadoOk(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar el polígono");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!confirm("¿Eliminar el polígono guardado? Esta acción no se puede deshacer desde aquí.")) {
      return;
    }
    setEliminando(true);
    setError(null);
    setGuardadoOk(false);
    setEliminadoOk(false);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? "Error al eliminar el polígono");
      }
      drawnLayerRef.current?.clearLayers();
      setTieneDibujo(false);
      setEliminadoOk(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar el polígono");
    } finally {
      setEliminando(false);
    }
  }

  return (
    <div>
      <div ref={mapRef} className="w-full h-80 rounded-lg border border-gray-200" />
      <div className="flex items-center justify-between mt-3">
        <p className="text-xs text-gray-400">
          {poligonoInicial
            ? `Versión vigente: v${poligonoInicial.version}${poligonoInicial.areaHaCalculada ? ` · ${poligonoInicial.areaHaCalculada} ha` : ""}`
            : soloLectura
              ? "Sin polígono registrado"
              : "Sin polígono registrado — dibújalo con la herramienta del mapa"}
        </p>
        {!soloLectura && (
          <div className="flex items-center gap-2">
            {poligonoInicial && (
              <button
                onClick={eliminar}
                disabled={guardando || eliminando}
                className="text-sm px-4 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {eliminando ? "Eliminando..." : "Eliminar polígono"}
              </button>
            )}
            <button
              onClick={guardar}
              disabled={guardando || eliminando || !tieneDibujo}
              className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar polígono"}
            </button>
          </div>
        )}
      </div>
      {guardadoOk && (
        <p className="text-xs text-green-600 font-medium mt-2">Polígono guardado correctamente</p>
      )}
      {eliminadoOk && (
        <p className="text-xs text-green-600 font-medium mt-2">Polígono eliminado correctamente</p>
      )}
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}
