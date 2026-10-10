// Pool de conexion PostgreSQL (reemplaza al cliente Prisma)
export { default as pool } from "./db/client.js";

// Funciones de acceso a datos SQL directo
export * from "./db/queries.js";
export * from "./db/queries-campanas.js";
export * from "./db/queries-eudr.js";
export * from "./db/queries-eudr-riesgo.js";
export * from "./db/queries-stbn.js";
export * from "./db/queries-poligonos.js";

// Utilidades de hashing e integridad — sin cambios, modulo puro
export {
  generarHashEvento,
  verificarHashEvento,
  generarHashArchivo,
  generarHashLote,
  generarCodigoLote,
  generarCodigoParcela,
  generarCodigoPredio,
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
  Propietario,
  Parcela,
  Pais,
  Departamento,
  Municipio,
  Lote,
  Planta,
  Especie,
  LotePlanta,
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
  PredioPoligono,
  ParcelaPoligono,
  EudrDeclaracion,
  EudrEvidenciaSatelital,
  EudrPaisRiesgo,
  EudrEvaluacionRiesgoPredio,
  EudrEvaluacionRiesgoParcela,
  EudrMedidaMitigacion,
  NivelRiesgo,
  NivelRiesgoPais,
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
