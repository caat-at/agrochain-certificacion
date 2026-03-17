// Cliente de base de datos
export { db } from "./lib/client.js";

// Utilidades de hashing e integridad
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
  type EventoCampoData,
} from "./lib/hash.js";

// Re-exportar tipos de Prisma para uso en otras apps
export type {
  Usuario,
  Organizacion,
  Predio,
  AnalisisSuelo,
  Planta,
  Lote,
  EventoProduccion,
  AplicacionAgroquimico,
  RegistroRiego,
  Inspeccion,
  ChecklistBpa,
  NumeralNtc5400,
  Certificado,
  Documento,
  BlockchainTx,
  Departamento,
  Municipio,
  RolUsuario,
  TipoDocumento,
  EstadoLote,
  EstadoSync,
  TipoEvento,
  CategoriaToxicologica,
  TipoCertificado,
  EstadoTx,
  Campana,
  CampanaTecnico,
  RegistroPlanta,
  AporteTecnico,
  EstadoCampana,
  EstadoRegistroPlanta,
} from "@prisma/client";
