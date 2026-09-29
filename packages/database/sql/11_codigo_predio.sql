-- =============================================================================
-- AGROCHAIN - Separar codigo_predio (autogenerado, siempre presente) de
-- codigo_ica (numero oficial del ICA, opcional, lo llena el usuario si lo tiene)
--
-- Contexto: se habia usado por error codigo_ica para el identificador
-- autogenerado del sistema (PRD-{municipio}-{secuencia}). El usuario aclaro
-- que son dos campos distintos: codigo_predio siempre se autogenera al crear
-- el predio (sea que el usuario llene el ICA o no), y codigo_ica sigue siendo
-- el numero real que asigna el ICA, opcional, sin relacion con el
-- autogenerado.
-- =============================================================================

ALTER TABLE predios ADD COLUMN IF NOT EXISTS codigo_predio varchar(50) UNIQUE;

-- Migrar datos existentes: los valores que ya siguen el patron PRD-*
-- (generados por error en codigo_ica durante las pruebas de esta sesion) se
-- mueven a codigo_predio y se limpia codigo_ica para esos casos -- no eran
-- codigos ICA reales.
UPDATE predios
SET codigo_predio = codigo_ica, codigo_ica = NULL
WHERE codigo_ica LIKE 'PRD-%';

-- Los predios que quedan sin codigo_predio (incluye los que tenian un
-- codigo_ica real como ANT-05-2024-00001, que se conserva intacto en
-- codigo_ica) reciben un codigo_predio autogenerado ahora, usando el mismo
-- formato PRD-{municipio_cod}-{secuencia}, secuencia por orden de creacion.
WITH secuencia AS (
  SELECT id, municipio_cod,
         row_number() OVER (ORDER BY created_at) AS seq
  FROM predios
  WHERE codigo_predio IS NULL
)
UPDATE predios p
SET codigo_predio = 'PRD-' || COALESCE(s.municipio_cod, '00000') || '-' || lpad(s.seq::text, 5, '0')
FROM secuencia s
WHERE p.id = s.id;

ALTER TABLE predios ALTER COLUMN codigo_predio SET NOT NULL;
