// ── Enums compartidos con el dominio ─────────────────────────────────────────

export type EstadoLote =
  | "REGISTRADO"
  | "EN_PRODUCCION"
  | "COSECHADO"
  | "INSPECCION_SOLICITADA"
  | "EN_INSPECCION"
  | "CERTIFICADO"
  | "RECHAZADO"
  | "REVOCADO";

export type RolUsuario =
  | "ADMIN"
  | "AGRICULTOR"
  | "INSPECTOR_ICA"
  | "INSPECTOR_BPA"
  | "CERTIFICADORA"
  | "INVIMA"
  | "CONSUMIDOR";

export type TipoCertificado =
  | "BPA_ICA"
  | "ORGANICO"
  | "GLOBAL_GAP"
  | "RAINFOREST"
  | "INVIMA_INOCUIDAD";

// ── Modelos de API ────────────────────────────────────────────────────────────

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
}

export interface LoteResumen {
  id: string;
  codigoLote: string;
  predioNombre: string;
  especie: string;
  variedad: string | null;
  estadoLote: EstadoLote;
  dataHash: string | null;
  agricultor?: { nombre: string };
  totalEventos?: number;
}

export interface Evento {
  id: string;
  tipoEvento: string;
  fechaEvento: string;
  descripcion: string;
  syncEstado: string;
  hashVerificado: boolean;
  contentHash: string | null;
  creadoEn: string;
  creadoPor?: { nombres: string; apellidos: string };
}

export interface Inspeccion {
  id: string;
  loteId: string;
  lote?: { codigoLote: string; especie: string; predio?: { nombrePredio: string } };
  inspectorId: string;
  inspector?: { nombres: string; apellidos: string };
  fechaInspeccion: string | null;
  resultado: "APROBADO" | "RECHAZADO" | null;
  puntajeBpa: number | null;
  observaciones: string | null;
  reporteHash: string | null;
  estado: string;
  createdAt: string;
}

export interface Certificado {
  id: string;
  loteId: string;
  lote?: { codigoLote: string; especie: string };
  numeroCertificado: string;
  tipo: TipoCertificado;
  fechaEmision: string;
  fechaVencimiento: string;
  revocado: boolean;
  tokenId: number | null;
  nftTxHash: string | null;
  aprobadoPor?: { nombres: string; apellidos: string };
}

export interface VerificacionPublica {
  codigoLote: string;
  especie: string;
  variedad: string | null;
  estado: EstadoLote;
  dataHash: string | null;
  predio: {
    nombre: string;
    municipio: string;
    departamento: string;
    latitud: number | null;
    longitud: number | null;
  };
  agricultor: { nombre: string };
  totalEventos: number;
  eventos: Array<{
    tipoEvento: string;
    fechaEvento: string;
    descripcion: string;
    hashVerificado: boolean;
  }>;
  campanas: Array<{
    nombre: string;
    campanaHash: string | null;
    txHash: string | null;
    fechaCierre: string | null;
  }>;
  inspeccion: {
    resultado: string | null;
    puntajeBpa: number | null;
    hallazgosCriticos: number | null;
    hallazgosMayores: number | null;
    hallazgosMenores: number | null;
    observaciones: string | null;
    reporteHash: string | null;
    txHash: string | null;
    fechaRealizada: string | null;
    inspector: string | null;
  } | null;
  blockchain: {
    registrado: boolean;
    loteIdHash: string | null;
    txRegistro: string | null;
    explorerUrl: string | null;
  };
  certificado: {
    numeroCertificado: string;
    tipo: TipoCertificado;
    fechaEmision: string;
    fechaVencimiento: string;
    valido: boolean;
    tokenId: number | null;
    txEmision: string | null;
    ipfsUri: string | null;
    aprobadoPor: string | null;
  } | null;
}
