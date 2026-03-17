// =============================================================================
// @agrochain/shared - Tipos y constantes compartidas entre apps
// =============================================================================

// ── CONSTANTES ───────────────────────────────────────────────────────────────

export const POLYGON_CONTRACTS = {
  LOTE_REGISTRY: process.env.CONTRACT_LOTE_REGISTRY ?? "",
  CERTIFICADO_NFT: process.env.CONTRACT_CERTIFICADO_NFT ?? "",
  ROLE_MANAGER: process.env.CONTRACT_ROLE_MANAGER ?? "",
} as const;

export const REDES_POLYGON = {
  AMOY: {
    chainId: 80002,
    name: "Polygon Amoy Testnet",
    rpcUrl: "https://rpc-amoy.polygon.technology",
    explorerUrl: "https://amoy.polygonscan.com",
    symbol: "MATIC",
  },
  MAINNET: {
    chainId: 137,
    name: "Polygon Mainnet",
    rpcUrl: "https://polygon-rpc.com",
    explorerUrl: "https://polygonscan.com",
    symbol: "POL",
  },
} as const;

// Periodos de carencia minimos por categoria toxicologica (dias)
export const PERIODOS_CARENCIA_MINIMOS: Record<string, number> = {
  IA_EXTREMADAMENTE_PELIGROSO: 30,
  IB_MUY_PELIGROSO: 21,
  II_MODERADAMENTE_PELIGROSO: 14,
  III_POCO_PELIGROSO: 7,
  IV_MUY_POCO_PELIGROSO: 3,
} as const;

// Puntaje minimo para aprobar inspeccion BPA (NTC 5400)
export const PUNTAJE_MINIMO_BPA = 85; // 85% de cumplimiento

// Radio GPS para detectar posible planta duplicada (metros)
export const RADIO_DUPLICADO_METROS = 2;

// ── TIPOS DE RESPUESTA API ───────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
}

// ── TIPOS SYNC MOVIL ─────────────────────────────────────────────────────────

export interface SyncPayload {
  eventoId: string;        // ID local del dispositivo
  contentHash: string;     // SHA256 generado en campo al guardar
  loteId: string;
  plantaId: string | null;
  tipoEvento: string;
  descripcion: string;
  fechaEvento: string;     // ISO 8601
  latitud: number | null;
  longitud: number | null;
  altitudMsnm: number | null;
  tecnicoId: string;
  datosExtra: Record<string, unknown>;
  fotoHash?: string;       // SHA256 de la foto si aplica
  audioHash?: string;      // SHA256 del audio si aplica
}

export interface SyncResultado {
  eventoId: string;
  aceptado: boolean;
  motivo?: string;         // Si rechazado, razon
  idServidor?: string;     // ID asignado por el servidor
  purgar: boolean;         // Si true, app puede borrar archivos pesados
}

// ── TIPOS VERIFICACION BLOCKCHAIN ───────────────────────────────────────────

export interface VerificacionLote {
  codigoLote: string;
  estado: string;
  hashOnChain: string;
  hashOffChain: string;
  integridadOk: boolean;   // hashOnChain === hashOffChain
  txRegistro: string;
  explorerUrl: string;
  eventos: VerificacionEvento[];
  certificado?: VerificacionCertificado;
}

export interface VerificacionEvento {
  tipo: string;
  fecha: string;
  evidenciaHash: string;
  txHash: string;
  explorerUrl: string;
}

export interface VerificacionCertificado {
  numeroCertificado: string;
  tipo: string;
  fechaEmision: string;
  fechaVencimiento: string;
  nftTokenId: string;
  certificadora: string;
  explorerUrl: string;
  ipfsMetadataUrl: string;
  valido: boolean;
}

// ── TIPOS FORMULARIOS CAMPO ──────────────────────────────────────────────────

export interface FormularioAplicacionAgroquimico {
  nombreProducto: string;
  registroIca: string;
  ingredienteActivo: string;
  categoriaToxicologica: string;
  dosisAplicada: number;
  unidadDosis: string;
  periodoCarenciaDias: number;
  fechaAplicacion: string;
  operario: string;
  eppUtilizado: string;
  justificacion: string;
}

export interface FormularioRiego {
  fuenteAgua: string;
  metodoRiego: string;
  volumenM3?: number;
  duracionHoras?: number;
}

export interface FormularioFertilizacion {
  nombreProducto: string;
  registroIca: string;
  tipoFertilizante: "QUIMICO" | "ORGANICO" | "FOLIAR" | "OTRO";
  dosisAplicada: number;
  unidadDosis: string;
  metodoAplicacion: string;
}
