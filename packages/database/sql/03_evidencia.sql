-- =============================================================================
-- AGROCHAIN - Evidencia binaria en S3 (Fase 4)
-- Generaliza Documento (IPFS/legacy) para cubrir tambien fotos/audio de
-- campanas multi-tecnico y evidencia satelital EUDR, que hoy no se suben a
-- ningun storage: el binario permanece en el dispositivo movil y solo se
-- sincroniza su hash SHA256. Esta tabla registra metadata; el binario vive en
-- S3, nunca en Postgres.
-- =============================================================================

CREATE TABLE evidencia_binaria (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo          varchar(30) NOT NULL, -- 'aporte' | 'evento' | 'documento' | 'eudr_satelital'
  entidad_id    uuid NOT NULL,        -- FK logico polimorfico (aporte_tecnico_id, evento_id, documento_id, eudr_declaracion_id)
  storage_key   text NOT NULL,        -- ruta jerarquica en el bucket S3
  original_name text NOT NULL,
  mimetype      varchar(100) NOT NULL,
  size_bytes    integer NOT NULL,
  sha256        varchar(64) NOT NULL, -- recalculado en servidor al subir; debe coincidir con el hash ya declarado por el cliente
  subido_por    uuid NOT NULL REFERENCES usuarios(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_evidencia_tipo_entidad ON evidencia_binaria(tipo, entidad_id);

-- Ahora que evidencia_binaria existe, se agrega la FK real de 02_eudr.sql
-- (se declaro como uuid suelto ahi porque este archivo corre despues en el
-- orden alfabetico de docker-entrypoint-initdb.d).
ALTER TABLE eudr_evidencias_satelitales
  ADD CONSTRAINT fk_eudr_evidencia_binaria
  FOREIGN KEY (evidencia_binaria_id) REFERENCES evidencia_binaria(id);

-- Igual que el resto de evidencia sellada: no se borra una vez vinculada a un
-- aporte/registro/declaracion ya inmutable. El borrado de evidencia huerfana
-- (subida y nunca vinculada) se permite a nivel de aplicacion, no aqui.
GRANT SELECT, INSERT, UPDATE, DELETE ON evidencia_binaria TO agrochain_app;
