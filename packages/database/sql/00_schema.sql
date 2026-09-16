-- =============================================================================
-- AGROCHAIN - Schema PostgreSQL (SQL directo, sin ORM)
-- Traduccion 1:1 de packages/database/prisma/schema.prisma
-- Normas: ICA, NTC 5400 BPA, INVIMA - Colombia
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Rol de aplicacion (sin privilegios de superusuario, ver 01_immutability.sql)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'agrochain_app') THEN
    CREATE ROLE agrochain_app LOGIN PASSWORD 'agrochain_app_dev';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE agrochain_db TO agrochain_app;
GRANT USAGE, CREATE ON SCHEMA public TO agrochain_app;

-- =============================================================================
-- FUNCION GENERICA updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE rol_usuario AS ENUM (
  'AGRICULTOR','INSPECTOR_ICA','INSPECTOR_BPA','CERTIFICADORA','INVIMA','ADMIN','CONSUMIDOR','TECNICO'
);

CREATE TYPE tipo_documento_identidad AS ENUM ('CC','CE','NIT','PPN');

CREATE TYPE tipo_organizacion AS ENUM ('CERTIFICADORA','ICA','INVIMA','COOPERATIVA','INDEPENDIENTE');

CREATE TYPE fuente_agua AS ENUM ('ACUEDUCTO','RIO','POZO','LLUVIA','MIXTA');

CREATE TYPE estado_lote AS ENUM (
  'REGISTRADO','EN_PRODUCCION','COSECHADO','INSPECCION_SOLICITADA','EN_INSPECCION','CERTIFICADO','RECHAZADO','REVOCADO'
);

CREATE TYPE destino_produccion AS ENUM ('CONSUMO_INTERNO','EXPORTACION','AGROINDUSTRIA','MIXTO');

CREATE TYPE tipo_evento AS ENUM (
  'PREPARACION_SUELO','SIEMBRA','FERTILIZACION','RIEGO','CONTROL_PLAGAS','CONTROL_ENFERMEDADES',
  'PODA','COSECHA','POSTCOSECHA','MONITOREO','OTRO'
);

CREATE TYPE categoria_toxicologica AS ENUM (
  'IA_EXTREMADAMENTE_PELIGROSO','IB_MUY_PELIGROSO','II_MODERADAMENTE_PELIGROSO','III_POCO_PELIGROSO','IV_MUY_POCO_PELIGROSO'
);

CREATE TYPE tipo_inspeccion AS ENUM ('ICA_INICIAL','ICA_SEGUIMIENTO','BPA_CERTIFICACION','BPA_RENOVACION','INVIMA','INTERNA');

CREATE TYPE resultado_inspeccion AS ENUM ('APROBADO','APROBADO_CON_OBSERVACIONES','RECHAZADO','PENDIENTE');

CREATE TYPE estado_inspeccion AS ENUM ('PROGRAMADA','EN_CURSO','COMPLETADA','CANCELADA');

-- STBN agregado desde el inicio para certificacion PlanetAI Nature Space (EUDR)
CREATE TYPE tipo_certificado AS ENUM ('BPA_ICA','ORGANICO','GLOBAL_GAP','RAINFOREST','INVIMA_INOCUIDAD','STBN');

CREATE TYPE estado_sync AS ENUM ('PENDIENTE','VERIFICADO','EN_CADENA','RECHAZADO');

CREATE TYPE tipo_documento_archivo AS ENUM ('FOTO','VIDEO','PDF','ANALISIS_LABORATORIO','CERTIFICADO','OTRO');

CREATE TYPE estado_tx AS ENUM ('PENDIENTE','CONFIRMADO','FALLIDO');

CREATE TYPE metodo_riego AS ENUM ('GOTEO','ASPERSION','GRAVEDAD','SURCOS');

CREATE TYPE criticidad_hallazgo AS ENUM ('CRITICO','MAYOR','MENOR');

CREATE TYPE estado_campana AS ENUM ('ACTIVA','ABIERTA','CERRADA');

CREATE TYPE estado_registro_planta AS ENUM ('PENDIENTE','PARCIAL','COMPLETO','ADULTERADO','INVALIDADO');

-- =============================================================================
-- USUARIOS Y ORGANIZACIONES
-- =============================================================================

CREATE TABLE usuarios (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombres           varchar(150) NOT NULL,
  apellidos         varchar(150) NOT NULL,
  tipo_documento    tipo_documento_identidad NOT NULL,
  numero_documento  varchar(30) UNIQUE NOT NULL,
  email             varchar(150) UNIQUE,
  telefono          varchar(30),
  wallet_address    varchar(42) UNIQUE,
  password_hash     varchar(255),
  cognito_sub       varchar(64) UNIQUE,
  rol               rol_usuario NOT NULL,
  activo            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_usuarios_updated_at BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE organizaciones (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       varchar(200) NOT NULL,
  nit          varchar(30) UNIQUE NOT NULL,
  tipo         tipo_organizacion NOT NULL,
  resolucion   varchar(100),
  vigencia     timestamptz,
  direccion    varchar(255),
  departamento varchar(100),
  municipio    varchar(100),
  activo       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE usuario_organizacion (
  usuario_id      uuid NOT NULL REFERENCES usuarios(id),
  organizacion_id uuid NOT NULL REFERENCES organizaciones(id),
  cargo           varchar(100),
  PRIMARY KEY (usuario_id, organizacion_id)
);

-- =============================================================================
-- PREDIOS
-- =============================================================================

CREATE TABLE predios (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agricultor_id            uuid NOT NULL REFERENCES usuarios(id),
  nombre_predio            varchar(200) NOT NULL,
  codigo_ica               varchar(50) UNIQUE,
  matricula_inmobiliaria   varchar(100),
  departamento             varchar(100) NOT NULL,
  municipio                varchar(100) NOT NULL,
  vereda                   varchar(150),
  direccion                varchar(255),
  latitud                  double precision NOT NULL,
  longitud                 double precision NOT NULL,
  altitud_msnm             double precision,
  area_total_ha            double precision NOT NULL,
  area_productiva_ha       double precision,
  area_bosque_ha           double precision,
  area_viveros_ha          double precision,
  fuente_agua              fuente_agua,
  tipo_suelo               varchar(50),
  pendiente_pct            double precision,
  uso_previo               varchar(150),
  certif_uso_suelo         varchar(100),
  tiene_bodega_agroquimicos boolean NOT NULL DEFAULT false,
  tiene_agua_potable        boolean NOT NULL DEFAULT false,
  tiene_sss_basicas         boolean NOT NULL DEFAULT false,
  tiene_zona_acopio         boolean NOT NULL DEFAULT false,
  activo                   boolean NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_predios_agricultor ON predios(agricultor_id);
CREATE TRIGGER trg_predios_updated_at BEFORE UPDATE ON predios FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE analisis_suelo (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  predio_id        uuid NOT NULL REFERENCES predios(id),
  fecha_muestreo   timestamptz NOT NULL,
  laboratorio      varchar(200) NOT NULL,
  ph               double precision,
  materia_organica double precision,
  nitrogeno        double precision,
  fosforo          double precision,
  potasio          double precision,
  calcio           double precision,
  magnesio         double precision,
  resultado_cid    varchar(100),
  resultado_hash   varchar(64),
  tx_hash          varchar(66),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_analisis_suelo_predio ON analisis_suelo(predio_id);

-- =============================================================================
-- LOTES
-- =============================================================================

CREATE TABLE lotes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  predio_id           uuid NOT NULL REFERENCES predios(id),
  agricultor_id       uuid NOT NULL REFERENCES usuarios(id),
  codigo_lote         varchar(30) UNIQUE NOT NULL,
  especie             varchar(150) NOT NULL,
  variedad            varchar(150) NOT NULL,
  area_ha             double precision NOT NULL,
  fecha_siembra       timestamptz,
  fecha_cosecha_est   timestamptz,
  fecha_cosecha_real  timestamptz,
  volumen_cosecha_kg  double precision,
  destino_produccion  destino_produccion,
  sistema_riego       varchar(50),
  distancia_siembra_m double precision,
  densidad_plantas    integer,
  cultivo_anterior    varchar(150),
  estado              estado_lote NOT NULL DEFAULT 'REGISTRADO',
  lote_id_onchain     varchar(66) UNIQUE,
  data_hash           varchar(64),
  tx_registro         varchar(66),
  sync_estado         estado_sync NOT NULL DEFAULT 'PENDIENTE',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lotes_predio ON lotes(predio_id);
CREATE INDEX idx_lotes_agricultor ON lotes(agricultor_id);
CREATE TRIGGER trg_lotes_updated_at BEFORE UPDATE ON lotes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- PLANTAS
-- =============================================================================

CREATE TABLE plantas (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id                     uuid NOT NULL REFERENCES lotes(id),
  codigo_planta                varchar(100) NOT NULL,
  numero_planta                varchar(50) NOT NULL,
  latitud                      double precision NOT NULL,
  longitud                     double precision NOT NULL,
  altitud_msnm                 double precision,
  especie                      varchar(150),
  variedad                     varchar(150),
  origen_material               varchar(50),
  procedencia_vivero            varchar(200),
  fecha_siembra                 timestamptz,
  altura_cm_inicial             double precision,
  diametro_tallo_cm_inicial     double precision,
  num_hojas_inicial             integer,
  estado_fenologico_inicial     varchar(50),
  activo                        boolean NOT NULL DEFAULT true,
  registrado_por                uuid NOT NULL REFERENCES usuarios(id),
  created_at                    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lote_id, codigo_planta),
  UNIQUE (lote_id, numero_planta)
);
CREATE INDEX idx_plantas_lote ON plantas(lote_id);

-- =============================================================================
-- EVENTOS DE PRODUCCION
-- =============================================================================

CREATE TABLE eventos_produccion (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id         uuid NOT NULL REFERENCES lotes(id),
  planta_id       uuid REFERENCES plantas(id),
  creado_por      uuid NOT NULL REFERENCES usuarios(id),
  tipo_evento     tipo_evento NOT NULL,
  descripcion     text NOT NULL,
  fecha_evento    timestamptz NOT NULL,
  latitud         double precision,
  longitud        double precision,
  altitud_msnm    double precision,
  content_hash    varchar(64) UNIQUE NOT NULL,
  hash_verificado boolean NOT NULL DEFAULT false,
  rechaz_motivo   text,
  sync_estado     estado_sync NOT NULL DEFAULT 'PENDIENTE',
  ipfs_cid        varchar(100),
  evidencia_hash  varchar(64),
  tx_hash         varchar(66),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_eventos_lote ON eventos_produccion(lote_id);
CREATE INDEX idx_eventos_planta ON eventos_produccion(planta_id);

CREATE TABLE aplicaciones_agroquimicos (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id                uuid UNIQUE NOT NULL REFERENCES eventos_produccion(id),
  lote_id                  uuid NOT NULL REFERENCES lotes(id),
  nombre_producto          varchar(200) NOT NULL,
  registro_ica             varchar(100) NOT NULL,
  ingrediente_activo       varchar(200) NOT NULL,
  categoria_toxicologica   categoria_toxicologica NOT NULL,
  dosis_aplicada           double precision NOT NULL,
  unidad_dosis             varchar(30) NOT NULL,
  periodo_carencia_dias    integer NOT NULL,
  fecha_ultima_aplicacion  timestamptz NOT NULL,
  fecha_cosecha_posible    timestamptz NOT NULL,
  operario_id              uuid,
  epp_utilizado            varchar(255),
  justificacion            text,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE registros_riego (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id         uuid UNIQUE NOT NULL REFERENCES eventos_produccion(id),
  lote_id           uuid NOT NULL REFERENCES lotes(id),
  fuente_agua       varchar(50) NOT NULL,
  metodo_riego      metodo_riego,
  volumen_m3        double precision,
  duracion_horas    double precision,
  analisis_agua_cid varchar(100),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- INSPECCIONES
-- =============================================================================

CREATE TABLE inspecciones (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id             uuid NOT NULL REFERENCES lotes(id),
  inspector_id        uuid NOT NULL REFERENCES usuarios(id),
  organizacion_id     uuid NOT NULL REFERENCES organizaciones(id),
  tipo_inspeccion     tipo_inspeccion NOT NULL,
  fecha_solicitud     timestamptz NOT NULL,
  fecha_programada    timestamptz,
  fecha_realizada     timestamptz,
  resultado           resultado_inspeccion NOT NULL DEFAULT 'PENDIENTE',
  puntaje             double precision,
  hallazgos_criticos  integer NOT NULL DEFAULT 0,
  hallazgos_mayores   integer NOT NULL DEFAULT 0,
  hallazgos_menores   integer NOT NULL DEFAULT 0,
  observaciones       text,
  plan_mejora         text,
  fecha_limite_mejora timestamptz,
  reporte_cid         varchar(100),
  reporte_hash        varchar(64),
  tx_hash             varchar(66),
  estado              estado_inspeccion NOT NULL DEFAULT 'PROGRAMADA',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_inspecciones_lote ON inspecciones(lote_id);
CREATE TRIGGER trg_inspecciones_updated_at BEFORE UPDATE ON inspecciones FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE numerales_ntc5400 (
  codigo      varchar(20) PRIMARY KEY,
  seccion     varchar(150) NOT NULL,
  descripcion text NOT NULL,
  criticidad  criticidad_hallazgo NOT NULL,
  aplica      varchar(255) NOT NULL
);

CREATE TABLE checklist_bpa (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspeccion_id  uuid NOT NULL REFERENCES inspecciones(id),
  numeral_ntc    varchar(20) NOT NULL REFERENCES numerales_ntc5400(codigo),
  descripcion    text NOT NULL,
  aplica         boolean NOT NULL DEFAULT true,
  cumple         boolean,
  criticidad     criticidad_hallazgo,
  evidencia_cid  varchar(100),
  observacion    text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_checklist_inspeccion ON checklist_bpa(inspeccion_id);

-- =============================================================================
-- CERTIFICADOS
-- =============================================================================

CREATE TABLE certificados (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id            uuid UNIQUE NOT NULL REFERENCES lotes(id),
  inspeccion_id      uuid UNIQUE REFERENCES inspecciones(id),
  certificadora_id   varchar(100),
  aprobado_por_id    uuid REFERENCES usuarios(id),
  tipo               tipo_certificado NOT NULL,
  numero_certificado varchar(100) UNIQUE NOT NULL,
  fecha_emision      timestamptz NOT NULL,
  fecha_vencimiento  timestamptz NOT NULL,
  revocado           boolean NOT NULL DEFAULT false,
  ipfs_uri           varchar(255),
  nft_token_id       varchar(50),
  tx_emision         varchar(66),
  qr_code_url        varchar(255),
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- DOCUMENTOS (repositorio general IPFS/legacy — evidencia_binaria en Fase 4 lo complementa para S3)
-- =============================================================================

CREATE TABLE documentos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo        tipo_documento_archivo NOT NULL,
  nombre      varchar(255) NOT NULL,
  ipfs_cid    varchar(100) UNIQUE NOT NULL,
  tamano_kb   integer,
  hash_sha256 varchar(64) NOT NULL,
  tx_hash     varchar(66),
  subido_por  uuid NOT NULL REFERENCES usuarios(id),
  lote_id     uuid REFERENCES lotes(id),
  evento_id   uuid REFERENCES eventos_produccion(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_documentos_lote ON documentos(lote_id);
CREATE INDEX idx_documentos_evento ON documentos(evento_id);

-- =============================================================================
-- BLOCKCHAIN TXS
-- =============================================================================

CREATE TABLE blockchain_txs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_hash    varchar(66) UNIQUE NOT NULL,
  red        varchar(30) NOT NULL DEFAULT 'polygon-amoy',
  contrato   varchar(100) NOT NULL,
  metodo     varchar(100) NOT NULL,
  entidad    varchar(50) NOT NULL,
  entidad_id varchar(100) NOT NULL,
  estado     estado_tx NOT NULL DEFAULT 'PENDIENTE',
  bloque     integer,
  gas_usado  integer,
  error_msg  text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_blockchain_txs_entidad ON blockchain_txs(entidad, entidad_id);

-- =============================================================================
-- GEOGRAFIA COLOMBIA
-- =============================================================================

CREATE TABLE departamentos (
  codigo varchar(5) PRIMARY KEY,
  nombre varchar(100) NOT NULL
);

CREATE TABLE municipios (
  codigo           varchar(10) PRIMARY KEY,
  nombre           varchar(150) NOT NULL,
  departamento_cod varchar(5) NOT NULL REFERENCES departamentos(codigo)
);
CREATE INDEX idx_municipios_departamento ON municipios(departamento_cod);

-- =============================================================================
-- CAMPAÑAS MULTI-TECNICO
-- =============================================================================

CREATE TABLE campanas (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id                uuid NOT NULL REFERENCES lotes(id),
  nombre                 varchar(200) NOT NULL,
  codigo                 varchar(50),
  descripcion            text,
  estado                 estado_campana NOT NULL DEFAULT 'ACTIVA',
  campos_requeridos      jsonb NOT NULL DEFAULT '[]'::jsonb,
  campana_hash           varchar(64),
  tx_hash                varchar(66),
  sync_estado            estado_sync NOT NULL DEFAULT 'PENDIENTE',
  cierre_con_advertencia boolean NOT NULL DEFAULT false,
  motivo_cierre          text,
  creada_por             uuid NOT NULL REFERENCES usuarios(id),
  cerrada_por            uuid REFERENCES usuarios(id),
  fecha_apertura         timestamptz NOT NULL DEFAULT now(),
  fecha_cierre           timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_campanas_lote ON campanas(lote_id);
CREATE TRIGGER trg_campanas_updated_at BEFORE UPDATE ON campanas FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE registros_planta (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campana_id                uuid NOT NULL REFERENCES campanas(id),
  planta_id                 uuid NOT NULL REFERENCES plantas(id),
  estado                    estado_registro_planta NOT NULL DEFAULT 'PENDIENTE',
  consecutivo               integer,
  fecha_evento               timestamptz,
  content_hash               varchar(64),
  tx_hash                    varchar(66),
  sync_estado                estado_sync NOT NULL DEFAULT 'PENDIENTE',
  adulterado_detectado_en     timestamptz,
  adulterado_detectado_por    varchar(100),
  registro_reemplazante_id    uuid,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_registros_planta_campana_planta ON registros_planta(campana_id, planta_id);
CREATE TRIGGER trg_registros_planta_updated_at BEFORE UPDATE ON registros_planta FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE campana_tecnicos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campana_id       uuid NOT NULL REFERENCES campanas(id),
  tecnico_id       uuid NOT NULL REFERENCES usuarios(id),
  posicion         integer NOT NULL,
  campos_asignados jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campana_id, posicion),
  UNIQUE (campana_id, tecnico_id)
);

CREATE TABLE aportes_tecnicos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_planta_id uuid NOT NULL REFERENCES registros_planta(id),
  campana_id         uuid NOT NULL REFERENCES campanas(id),
  tecnico_id         uuid NOT NULL REFERENCES usuarios(id),
  posicion           integer NOT NULL,
  campos             jsonb NOT NULL DEFAULT '{}'::jsonb,
  foto_hash          varchar(64),
  foto_uri           text,
  audio_hash         varchar(64),
  audio_uri          text,
  content_hash       varchar(64) UNIQUE NOT NULL,
  hash_verificado    boolean NOT NULL DEFAULT false,
  hash_rechaz_motivo text,
  latitud            double precision,
  longitud           double precision,
  fecha_aporte       timestamptz NOT NULL DEFAULT now(),
  sync_estado        varchar(20) NOT NULL DEFAULT 'PENDIENTE',
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (registro_planta_id, tecnico_id)
);
CREATE INDEX idx_aportes_registro ON aportes_tecnicos(registro_planta_id);
CREATE INDEX idx_aportes_campana ON aportes_tecnicos(campana_id);

-- =============================================================================
-- HISTORIAL DE VERIFICACIONES DE INTEGRIDAD
-- =============================================================================

CREATE TABLE verificaciones_integridad (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campana_id         uuid NOT NULL REFERENCES campanas(id),
  ejecutado_por_id   uuid NOT NULL REFERENCES usuarios(id),
  fecha_verificacion timestamptz NOT NULL DEFAULT now(),
  total_registros    integer NOT NULL,
  aprobados          integer NOT NULL,
  adulterados        integer NOT NULL,
  ok                 boolean NOT NULL
);
CREATE INDEX idx_verificaciones_campana ON verificaciones_integridad(campana_id);

CREATE TABLE verificaciones_registro_detalle (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verificacion_id uuid NOT NULL REFERENCES verificaciones_integridad(id),
  registro_id     uuid NOT NULL,
  planta_id       uuid NOT NULL,
  hash_guardado   varchar(64) NOT NULL,
  hash_calculado  varchar(64) NOT NULL,
  resultado       varchar(20) NOT NULL
);
CREATE INDEX idx_verificaciones_detalle_verificacion ON verificaciones_registro_detalle(verificacion_id);

CREATE TABLE verificaciones_hash_campana (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campana_id         uuid NOT NULL REFERENCES campanas(id),
  ejecutado_por_id   uuid NOT NULL REFERENCES usuarios(id),
  fecha_verificacion timestamptz NOT NULL DEFAULT now(),
  ok                 boolean NOT NULL,
  hash_guardado      varchar(64) NOT NULL,
  hash_recalculado   varchar(64) NOT NULL,
  total_registros    integer NOT NULL,
  tx_hash            varchar(66),
  hash_en_polygon    varchar(64),
  block_number       integer,
  timestamp_polygon  integer,
  ok_db              boolean,
  ok_polygon         boolean,
  polygon_error      text
);
CREATE INDEX idx_verificaciones_hash_campana_campana ON verificaciones_hash_campana(campana_id);

-- =============================================================================
-- PERMISOS FINALES — el rol de aplicacion opera sobre todas las tablas creadas
-- (los REVOKE selectivos de DELETE/TRUNCATE se aplican en 01_immutability.sql)
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO agrochain_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO agrochain_app;
