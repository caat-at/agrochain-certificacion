-- =============================================================================
-- AGROCHAIN - Username como alias de login, ademas del email (patron SSE)
-- Cognito sigue usando email como Username inmutable — este campo es
-- puramente local, para permitir login con "username o email" indistinto
-- (ver getUsuarioByUsernameOrEmail en packages/database/src/db/queries.ts).
-- Nullable a nivel de schema para no romper los usuarios ya existentes sin
-- username; se exige en el formulario de creacion de usuarios nuevos.
-- =============================================================================

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS username varchar(50) UNIQUE;
