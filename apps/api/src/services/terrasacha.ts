/**
 * Cliente del backend de Oráculo Terrasacha (historial satelital de la parcela).
 * Contrato real verificado en el repo del proveedor (geoMapasDocker):
 *   POST /api/v1/login                         — Cognito USER_PASSWORD_AUTH → IdToken
 *   POST /api/v1/satellites-imagenes/search    — escenas disponibles en rango/fecha/cobertura
 *   POST /api/v1/previsualizar-imagen          — plantilla XYZ (Earth Engine) de una escena
 *
 * Auth: la cuenta de servicio inicia sesión con USERNAME/PASSWORD (env del
 * backend, NUNCA en el browser) y cachea el IdToken con expiración. El token
 * se manda como `Authorization: Bearer`. El endpoint exige permiso sobre el
 * tag "analisis" (require_permission), no existe bypass por X-Internal-Token
 * (definido en el repo pero no cableado).
 *
 * `isTerrasachaConfigured()` es el interruptor: con credenciales vacías la
 * ruta responde 503 en vez de fallar (mismo patrón que blockchain.ts).
 */

const BASE_URL = process.env.TERRASACHA_API_BASE_URL ?? "https://qi3fmd7w53.us-east-1.awsapprunner.com";
const CLIENT_ID = process.env.TERRASACHA_CLIENT_ID;
const USERNAME = process.env.TERRASACHA_USERNAME;
const PASSWORD = process.env.TERRASACHA_PASSWORD;

const REQUEST_TIMEOUT_MS = 30_000;

// ── Tipos del contrato ───────────────────────────────────────────────────────

export interface EscenaSatelital {
  id: string;
  fecha: string;
  satellite_id: string;
  satelite: string;
  nubosidad: number | string | null;
}

export interface ConsultaSatelital {
  images: EscenaSatelital[];
  total_encontradas: number;
}

export interface PreviewResultado {
  tiles: string;
  min: number;
  max: number;
  name: string;
}

export interface BuscarEscenasParams {
  satellite: string;
  /** Anillo cerrado [[lon,lat], ...] — el tema del polígono de la parcela */
  coordenadas: number[][];
  fechaDesde: string; // YYYY-MM-DD
  fechaHasta: string; // YYYY-MM-DD
  nubosidad: number;
}

export class TerrasachaNoConfiguradoError extends Error {}

export class TerrasachaApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown
  ) {
    super(`Terrasacha respondió ${status}: ${JSON.stringify(body)}`);
  }
}

// ── Estado del servicio ──────────────────────────────────────────────────────

let _idToken: string | null = null;
let _tokenExpiraEn = 0;
let _loginInFlight: Promise<string> | null = null;

export function isTerrasachaConfigured(): boolean {
  return Boolean(BASE_URL && CLIENT_ID && USERNAME && PASSWORD);
}

function ensureCredenciales(): void {
  if (!isTerrasachaConfigured()) {
    throw new TerrasachaNoConfiguradoError("Terrasacha no está configurado (TERRASACHA_USERNAME / TERRASACHA_PASSWORD)");
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────
// El IdToken expira (típicamente 1h, viene en `ExpiresIn`). Se refresca con un
// nuevo login. `_loginInFlight` evita dos logins simultáneos si varias peticiones
// llegan a la vez con el token vencido.
async function obtenerIdToken(): Promise<string> {
  ensureCredenciales();
  if (_idToken && Date.now() < _tokenExpiraEn) return _idToken;
  if (_loginInFlight) return _loginInFlight;

  _loginInFlight = (async () => {
    const res = await fetch(`${BASE_URL}/api/v1/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: CLIENT_ID,
        AuthParameters: {
          USERNAME: USERNAME!,
          PASSWORD: PASSWORD!,
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new TerrasachaApiError(res.status, await res.text().catch(() => null));
    }

    const data = (await res.json()) as {
      AuthenticationResult?: { IdToken?: string; ExpiresIn?: number };
    };
    const auth = data.AuthenticationResult;
    if (!auth?.IdToken) {
      throw new TerrasachaApiError(200, { error: "login sin IdToken" });
    }

    _idToken = auth.IdToken;
    // Margen de 60s para no pelear con el reloj entre servidores.
    _tokenExpiraEn = Date.now() + (auth.ExpiresIn ? (auth.ExpiresIn - 60) * 1000 : 60 * 60 * 1000);
    return _idToken;
  })();

  try {
    return await _loginInFlight;
  } finally {
    _loginInFlight = null;
  }
}

// Un 401 durante la consulta puede ser token vencido entre el check y el uso:
// reintenta una vez forzando login nuevo.
async function peticionTerrasacha(path: string, body: unknown, reintenta = true): Promise<unknown> {
  const token = await obtenerIdToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (res.status === 401 && reintenta) {
    _idToken = null;
    _tokenExpiraEn = 0;
    return peticionTerrasacha(path, body, false);
  }
  if (!res.ok) {
    throw new TerrasachaApiError(res.status, await res.text().catch(() => null));
  }
  return res.json();
}

// ── Endpoints ────────────────────────────────────────────────────────────────

export async function buscarEscenas(params: BuscarEscenasParams): Promise<ConsultaSatelital> {
  const [desde, hasta] = [params.fechaDesde.split("-"), params.fechaHasta.split("-")];

  const body = {
    satellite: params.satellite,
    coordenadas: params.coordenadas,
    year_initial: Number(desde[0]),
    month_initial: Number(desde[1]),
    day_initial: Number(desde[2]),
    year_final: Number(hasta[0]),
    month_final: Number(hasta[1]),
    day_final: Number(hasta[2]),
    nubosidad: params.nubosidad,
  };

  const data = (await peticionTerrasacha("/api/v1/satellites-imagenes/search", body)) as {
    images?: EscenaSatelital[];
    total_encontradas?: number;
  };

  return {
    images: Array.isArray(data.images) ? data.images : [],
    total_encontradas: data.total_encontradas ?? data.images?.length ?? 0,
  };
}

export async function previsualizarEscena(params: {
  imageId: string;
  satellite: string;
  bandas: string[];
  coordenadas: number[][];
}): Promise<PreviewResultado> {
  const data = (await peticionTerrasacha("/api/v1/previsualizar-imagen", {
    image_id: params.imageId,
    satellite: params.satellite,
    bandas: params.bandas,
    coordenadas: params.coordenadas,
  })) as PreviewResultado;

  if (!data?.tiles) {
    throw new TerrasachaApiError(200, { error: "previsualizar sin plantilla tiles" });
  }
  return data;
}

// ── Utilidades compartidas con la ruta ───────────────────────────────────────

// Extrae el anillo [[lon,lat],...] de una parcela GeoJSON. El frontend guardó
// cualquiera de los tipos Polygon/MultiPolygon dibujados con Leaflet; Terrasacha
// espera un único anillo cerrado (el primero del Feature/Geometry, ignorando
// posibles huecos). Si no hay geometry util, devuelve null → la ruta responde 400.
export function coordenadasParcelaDesdeGeoJson(geojson: Record<string, unknown>): number[][] | null {
  const geometry = (geojson as any).geometry ?? geojson;
  const type = geometry?.type;
  const coords = geometry?.coordinates;

  let ring: unknown = null;
  if (type === "Polygon" && Array.isArray(coords) && Array.isArray(coords[0])) {
    ring = coords[0];
  } else if (type === "MultiPolygon" && Array.isArray(coords) && Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
    ring = coords[0][0];
  }

  if (!Array.isArray(ring)) return null;

  const anillo = (ring as unknown[]).map((p) => {
    const pt = p as unknown[];
    return [Number(pt[0]), Number(pt[1])];
  });

  if (anillo.length < 3) return null;

  // El frontend de Terrasacha cierra el anillo repitiendo el primer punto; el
  // backend lo pasa directo a ee.Geometry.Polygon, que requiere anillo cerrado.
  const primero = anillo[0];
  const ultimo = anillo[anillo.length - 1];
  if (primero[0] !== ultimo[0] || primero[1] !== ultimo[1]) {
    anillo.push(primero);
  }

  return anillo;
}