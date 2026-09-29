-- =============================================================================
-- AGROCHAIN - Propietarios de predio (sin cuenta de usuario/login)
-- Hasta ahora predios.agricultor_id apuntaba obligatoriamente a un usuario
-- con rol AGRICULTOR (requeria email/username/password aunque el dueño
-- legal del predio no necesite ni deba loguearse). Se separa el concepto:
-- - propietarios: dueño legal del predio, solo datos de contacto/documento.
-- - predios.agricultor_id: pasa a ser opcional — solo se usa si ademas se
--   quiere que un usuario AGRICULTOR opere/vea el predio en el sistema.
-- =============================================================================

CREATE TABLE IF NOT EXISTS propietarios (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombres           varchar(150) NOT NULL,
  apellidos         varchar(150) NOT NULL,
  tipo_documento    tipo_documento_identidad NOT NULL,
  numero_documento  varchar(30) UNIQUE NOT NULL,
  email             varchar(150),
  telefono          varchar(30),
  direccion         varchar(255),
  activo            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_propietarios_updated_at BEFORE UPDATE ON propietarios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE predios ADD COLUMN IF NOT EXISTS propietario_id uuid REFERENCES propietarios(id);
ALTER TABLE predios ALTER COLUMN agricultor_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_predios_propietario ON predios(propietario_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON propietarios TO agrochain_app;
