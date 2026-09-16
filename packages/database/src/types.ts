// =============================================================================
// AGROCHAIN - Tipos de dominio (reemplazan los tipos generados por Prisma)
// Todas las columnas snake_case de Postgres se exponen en camelCase via alias
// SQL en queries.ts, para no tener que tocar el resto del codigo de rutas
// (heredado de Prisma, que ya trabajaba en camelCase).
// =============================================================================

export type RolUsuario =
  | "AGRICULTOR"
  | "INSPECTOR_ICA"
  | "INSPECTOR_BPA"
  | "CERTIFICADORA"
  | "INVIMA"
  | "ADMIN"
  | "CONSUMIDOR"
  | "TECNICO";

export type TipoDocumento = "CC" | "CE" | "NIT" | "PPN";
export type TipoOrganizacion = "CERTIFICADORA" | "ICA" | "INVIMA" | "COOPERATIVA" | "INDEPENDIENTE";
export type FuenteAgua = "ACUEDUCTO" | "RIO" | "POZO" | "LLUVIA" | "MIXTA";
export type EstadoLote =
  | "REGISTRADO"
  | "EN_PRODUCCION"
  | "COSECHADO"
  | "INSPECCION_SOLICITADA"
  | "EN_INSPECCION"
  | "CERTIFICADO"
  | "RECHAZADO"
  | "REVOCADO";
export type DestinoProduccion = "CONSUMO_INTERNO" | "EXPORTACION" | "AGROINDUSTRIA" | "MIXTO";
export type TipoEvento =
  | "PREPARACION_SUELO"
  | "SIEMBRA"
  | "FERTILIZACION"
  | "RIEGO"
  | "CONTROL_PLAGAS"
  | "CONTROL_ENFERMEDADES"
  | "PODA"
  | "COSECHA"
  | "POSTCOSECHA"
  | "MONITOREO"
  | "OTRO";
export type CategoriaToxicologica =
  | "IA_EXTREMADAMENTE_PELIGROSO"
  | "IB_MUY_PELIGROSO"
  | "II_MODERADAMENTE_PELIGROSO"
  | "III_POCO_PELIGROSO"
  | "IV_MUY_POCO_PELIGROSO";
export type TipoInspeccion = "ICA_INICIAL" | "ICA_SEGUIMIENTO" | "BPA_CERTIFICACION" | "BPA_RENOVACION" | "INVIMA" | "INTERNA";
export type ResultadoInspeccion = "APROBADO" | "APROBADO_CON_OBSERVACIONES" | "RECHAZADO" | "PENDIENTE";
export type EstadoInspeccion = "PROGRAMADA" | "EN_CURSO" | "COMPLETADA" | "CANCELADA";
export type TipoCertificado = "BPA_ICA" | "ORGANICO" | "GLOBAL_GAP" | "RAINFOREST" | "INVIMA_INOCUIDAD" | "STBN";
export type EstadoSync = "PENDIENTE" | "VERIFICADO" | "EN_CADENA" | "RECHAZADO";
export type TipoDocumentoArchivo = "FOTO" | "VIDEO" | "PDF" | "ANALISIS_LABORATORIO" | "CERTIFICADO" | "OTRO";
export type EstadoTx = "PENDIENTE" | "CONFIRMADO" | "FALLIDO";
export type MetodoRiego = "GOTEO" | "ASPERSION" | "GRAVEDAD" | "SURCOS";
export type CriticidadHallazgo = "CRITICO" | "MAYOR" | "MENOR";
export type EstadoCampana = "ACTIVA" | "ABIERTA" | "CERRADA";
export type EstadoRegistroPlanta = "PENDIENTE" | "PARCIAL" | "COMPLETO" | "ADULTERADO" | "INVALIDADO";

export interface Usuario {
  id: string;
  nombres: string;
  apellidos: string;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  email: string | null;
  telefono: string | null;
  walletAddress: string | null;
  passwordHash: string | null;
  cognitoSub: string | null;
  rol: RolUsuario;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organizacion {
  id: string;
  nombre: string;
  nit: string;
  tipo: TipoOrganizacion;
  resolucion: string | null;
  vigencia: Date | null;
  direccion: string | null;
  departamento: string | null;
  municipio: string | null;
  activo: boolean;
  createdAt: Date;
}

export interface Predio {
  id: string;
  agricultorId: string;
  nombrePredio: string;
  codigoIca: string | null;
  matriculaInmobiliaria: string | null;
  departamento: string;
  municipio: string;
  vereda: string | null;
  direccion: string | null;
  latitud: number;
  longitud: number;
  altitudMsnm: number | null;
  areaTotalHa: number;
  areaProductivaHa: number | null;
  areaBosqueHa: number | null;
  areaViverosHa: number | null;
  fuenteAgua: FuenteAgua | null;
  tipoSuelo: string | null;
  pendientePct: number | null;
  usoPrevio: string | null;
  certifUsoSuelo: string | null;
  tieneBodegaAgroquimicos: boolean;
  tieneAguaPotable: boolean;
  tieneSSSBasicas: boolean;
  tieneZonaAcopio: boolean;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Lote {
  id: string;
  predioId: string;
  agricultorId: string;
  codigoLote: string;
  especie: string;
  variedad: string;
  areaHa: number;
  fechaSiembra: Date | null;
  fechaCosechaEst: Date | null;
  fechaCosechaReal: Date | null;
  volumenCosechaKg: number | null;
  destinoProduccion: DestinoProduccion | null;
  sistemaRiego: string | null;
  distanciaSiembraM: number | null;
  densidadPlantas: number | null;
  cultivoAnterior: string | null;
  estado: EstadoLote;
  loteIdOnchain: string | null;
  dataHash: string | null;
  txRegistro: string | null;
  syncEstado: EstadoSync;
  createdAt: Date;
  updatedAt: Date;
}

export interface Planta {
  id: string;
  loteId: string;
  codigoPlanta: string;
  numeroPlanta: string;
  latitud: number;
  longitud: number;
  altitudMsnm: number | null;
  especie: string | null;
  variedad: string | null;
  origenMaterial: string | null;
  procedenciaVivero: string | null;
  fechaSiembra: Date | null;
  alturaCmInicial: number | null;
  diametroTalloCmInicial: number | null;
  numHojasInicial: number | null;
  estadoFenologicoInicial: string | null;
  activo: boolean;
  registradoPor: string;
  createdAt: Date;
}

export interface EventoProduccion {
  id: string;
  loteId: string;
  plantaId: string | null;
  creadoPor: string;
  tipoEvento: TipoEvento;
  descripcion: string;
  fechaEvento: Date;
  latitud: number | null;
  longitud: number | null;
  altitudMsnm: number | null;
  contentHash: string;
  hashVerificado: boolean;
  rechazMotivo: string | null;
  syncEstado: EstadoSync;
  ipfsCid: string | null;
  evidenciaHash: string | null;
  txHash: string | null;
  createdAt: Date;
}

export interface Inspeccion {
  id: string;
  loteId: string;
  inspectorId: string;
  organizacionId: string;
  tipoInspeccion: TipoInspeccion;
  fechaSolicitud: Date;
  fechaProgramada: Date | null;
  fechaRealizada: Date | null;
  resultado: ResultadoInspeccion;
  puntaje: number | null;
  hallazgosCriticos: number;
  hallazgosMayores: number;
  hallazgosMenores: number;
  observaciones: string | null;
  planMejora: string | null;
  fechaLimiteMejora: Date | null;
  reporteCid: string | null;
  reporteHash: string | null;
  txHash: string | null;
  estado: EstadoInspeccion;
  createdAt: Date;
  updatedAt: Date;
}

export interface Certificado {
  id: string;
  loteId: string;
  inspeccionId: string | null;
  certificadoraId: string | null;
  aprobadoPorId: string | null;
  tipo: TipoCertificado;
  numeroCertificado: string;
  fechaEmision: Date;
  fechaVencimiento: Date;
  revocado: boolean;
  ipfsUri: string | null;
  nftTokenId: string | null;
  txEmision: string | null;
  qrCodeUrl: string | null;
  createdAt: Date;
}

export interface Documento {
  id: string;
  tipo: TipoDocumentoArchivo;
  nombre: string;
  ipfsCid: string;
  tamanoKb: number | null;
  hashSha256: string;
  txHash: string | null;
  subidoPor: string;
  loteId: string | null;
  eventoId: string | null;
  createdAt: Date;
}

export interface BlockchainTx {
  id: string;
  txHash: string;
  red: string;
  contrato: string;
  metodo: string;
  entidad: string;
  entidadId: string;
  estado: EstadoTx;
  bloque: number | null;
  gasUsado: number | null;
  errorMsg: string | null;
  createdAt: Date;
}

export interface Campana {
  id: string;
  loteId: string;
  nombre: string;
  codigo: string | null;
  descripcion: string | null;
  estado: EstadoCampana;
  camposRequeridos: string[];
  campanaHash: string | null;
  txHash: string | null;
  syncEstado: EstadoSync;
  cierreConAdvertencia: boolean;
  motivoCierre: string | null;
  creadaPor: string;
  cerradaPor: string | null;
  fechaApertura: Date;
  fechaCierre: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampanaTecnico {
  id: string;
  campanaId: string;
  tecnicoId: string;
  posicion: number;
  camposAsignados: string[];
  createdAt: Date;
}

export interface RegistroPlanta {
  id: string;
  campanaId: string;
  plantaId: string;
  estado: EstadoRegistroPlanta;
  consecutivo: number | null;
  fechaEvento: Date | null;
  contentHash: string | null;
  txHash: string | null;
  syncEstado: EstadoSync;
  adulteradoDetectadoEn: Date | null;
  adulteradoDetectadoPor: string | null;
  registroReemplazanteId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AporteTecnico {
  id: string;
  registroPlantaId: string;
  campanaId: string;
  tecnicoId: string;
  posicion: number;
  campos: Record<string, unknown>;
  fotoHash: string | null;
  fotoUri: string | null;
  audioHash: string | null;
  audioUri: string | null;
  contentHash: string;
  hashVerificado: boolean;
  hashRechazMotivo: string | null;
  latitud: number | null;
  longitud: number | null;
  fechaAporte: Date;
  syncEstado: string;
  createdAt: Date;
}

export interface VerificacionIntegridad {
  id: string;
  campanaId: string;
  ejecutadoPorId: string;
  fechaVerificacion: Date;
  totalRegistros: number;
  aprobados: number;
  adulterados: number;
  ok: boolean;
}

export interface VerificacionRegistroDetalle {
  id: string;
  verificacionId: string;
  registroId: string;
  plantaId: string;
  hashGuardado: string;
  hashCalculado: string;
  resultado: string;
}

export interface VerificacionHashCampana {
  id: string;
  campanaId: string;
  ejecutadoPorId: string;
  fechaVerificacion: Date;
  ok: boolean;
  hashGuardado: string;
  hashRecalculado: string;
  totalRegistros: number;
  txHash: string | null;
  hashEnPolygon: string | null;
  blockNumber: number | null;
  timestampPolygon: number | null;
  okDB: boolean | null;
  okPolygon: boolean | null;
  polygonError: string | null;
}

// ── Modulo EUDR ──────────────────────────────────────────────────────────────

export type EstadoDeclaracionEudr = "BORRADOR" | "FIRMADA" | "ANCLADA_BLOCKCHAIN" | "RECHAZADA";

export interface LotePoligono {
  id: string;
  loteId: string;
  geojson: Record<string, unknown>;
  areaHaCalculada: number | null;
  fuente: string;
  version: number;
  vigente: boolean;
  creadoPor: string;
  createdAt: Date;
}

export interface EudrDeclaracion {
  id: string;
  loteId: string;
  poligonoId: string;
  fechaCorte: string;
  libreDeforestacion: boolean;
  fechaDeclaracion: Date;
  declaradoPor: string;
  contentHash: string;
  estado: EstadoDeclaracionEudr;
  txHash: string | null;
  observaciones: string | null;
  createdAt: Date;
}

export interface EudrEvidenciaSatelital {
  id: string;
  declaracionId: string;
  tipoEvidencia: string;
  descripcion: string | null;
  fechaCaptura: string | null;
  fuenteDeclarada: string | null;
  evidenciaBinariaId: string;
  cargadoPor: string;
  createdAt: Date;
}

export interface EvidenciaBinaria {
  id: string;
  tipo: string;
  entidadId: string;
  storageKey: string;
  originalName: string;
  mimetype: string;
  sizeBytes: number;
  sha256: string;
  subidoPor: string;
  createdAt: Date;
}

// ── Modulo STBN — pilares evaluables manualmente ─────────────────────────────

export type PilarStbn = "CONSERVACION" | "COMUNIDAD" | "JUSTICIA_SOCIAL" | "TECNOLOGIA" | "DERECHOS_HUMANOS";
export type NivelCalificacionStbn = "ALTO" | "BAJO";
export type EstadoEvaluacionStbn = "EN_PROGRESO" | "FINALIZADA";

export interface StbnEvidenciaPilar {
  id: string;
  predioId: string;
  pilar: PilarStbn;
  titulo: string;
  narrativa: string;
  periodoDesde: string | null;
  periodoHasta: string | null;
  registradoPor: string;
  createdAt: Date;
}

export interface StbnSubcriterio {
  codigo: string;
  pilar: PilarStbn;
  nombre: string;
  orden: number;
  puntajeAlto: number;
  puntajeBajo: number;
  descripcionAlto: string;
  descripcionBajo: string;
}

export interface StbnEvaluacion {
  id: string;
  predioId: string;
  estado: EstadoEvaluacionStbn;
  puntajeTotal: number | null; // subtotal 0-60, sin EUDR
  resultadoHash: string | null;
  txHash: string | null;
  iniciadaPor: string;
  finalizadaPor: string | null;
  fechaFinalizacion: Date | null;
  version: number;
  vigente: boolean;
  createdAt: Date;
}

export interface StbnEvaluacionSubcriterio {
  id: string;
  evaluacionId: string;
  subcriterioCodigo: string;
  nivel: NivelCalificacionStbn;
  puntajeAsignado: number;
  justificacion: string | null;
  evaluadoPor: string;
  evaluadoEn: Date;
}

export interface PilarStbnResumen {
  subcriterios: Array<{
    codigo: string;
    nombre: string;
    nivel: NivelCalificacionStbn | null;
    puntajeAsignado: number | null;
    puntajeMaximo: number;
  }>;
  subtotal: number;
  maximo: number;
}

export interface PuntajeStbnLote {
  loteId: string;
  predioId: string;
  pilares: {
    conservacion: PilarStbnResumen;
    comunidad: PilarStbnResumen;
    justiciaSocial: PilarStbnResumen;
    tecnologia: PilarStbnResumen;
    derechosHumanos: PilarStbnResumen;
    eudr: {
      cumpleUmbral: boolean;
      declaracionEstado: string | null;
      libreDeforestacion: boolean | null;
      subtotal: number; // 40 o 0
      maximo: 40;
    };
  };
  puntajeTotal: number;
  estadoElegibilidad: "APROBADO" | "REVISION_CONDICIONAL" | "NO_ELEGIBLE";
  evaluacionPilaresCompleta: boolean;
}
