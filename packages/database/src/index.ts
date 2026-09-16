// Pool de conexion PostgreSQL (reemplaza al cliente Prisma)
export { default as pool } from "./db/client.js";

// Funciones de acceso a datos SQL directo
export * from "./db/queries.js";
export * from "./db/queries-campanas.js";
export * from "./db/queries-eudr.js";
export * from "./db/queries-stbn.js";

// Utilidades de hashing e integridad — sin cambios, modulo puro
export {
  generarHashEvento,
  verificarHashEvento,
  generarHashArchivo,
  generarHashLote,
  generarCodigoLote,
  generarFirmaAporte,
  verificarFirmaAporte,
  generarContentHashRegistro,
  generarContentHashAporte,
  generarHashCampana,
  verificarCamposCompletos,
  generarContentHashDeclaracionEudr,
  generarContentHashEvaluacionStbn,
  type EventoCampoData,
} from "./lib/hash.js";

// Tipos de dominio (reemplazan los tipos generados por Prisma)
export type {
  Usuario,
  Organizacion,
  Predio,
  Lote,
  Planta,
  EventoProduccion,
  Inspeccion,
  Certificado,
  Documento,
  BlockchainTx,
  Campana,
  CampanaTecnico,
  RegistroPlanta,
  AporteTecnico,
  VerificacionIntegridad,
  VerificacionRegistroDetalle,
  VerificacionHashCampana,
  LotePoligono,
  EudrDeclaracion,
  EudrEvidenciaSatelital,
  EvidenciaBinaria,
  StbnSubcriterio,
  StbnEvidenciaPilar,
  StbnEvaluacion,
  StbnEvaluacionSubcriterio,
  PuntajeStbnLote,
  PilarStbnResumen,
  RolUsuario,
  TipoDocumento,
  EstadoLote,
  EstadoSync,
  TipoEvento,
  CategoriaToxicologica,
  TipoCertificado,
  EstadoTx,
  EstadoCampana,
  EstadoRegistroPlanta,
  EstadoDeclaracionEudr,
  PilarStbn,
  NivelCalificacionStbn,
  EstadoEvaluacionStbn,
} from "./types.js";
