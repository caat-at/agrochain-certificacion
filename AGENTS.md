# AGENTS.md — Contexto de sesión AgroChain

> **Propósito:** documento de recuperación. Si la sesión se compacta o se
> reinicia, leer esto primero para recuperar el contexto sin preguntar nada.
> Actualizar al cerrar cada bloque de trabajo.

**Última actualización:** 2026-10-06
**Rama:** `main` · **HEAD:** `23d85dc` (1 commit sin pushear)
**Equipo:** 2 personas trabajando como 1.

---

## 0. Reglas de commits (obligatorio)

El historial es **Conventional Commits en español**: 34 de los últimos 40 commits
usan prefijo. No inventar otro formato.

```
fix: <verbo en infinitivo, minúscula, sin punto final>
feat: <verbo en infinitivo, minúscula, sin punto final>
chore: <verbo en infinitivo, minúscula, sin punto final>
```

- **Empieza siempre por `tipo:`** y después **verbo en infinitivo**: `evitar`,
  `permitir`, `agregar`, `corregir`, `borrar`, `exigir`. Ese es el estilo real
  del repo, no inventar pasado, en inglés ni con punto final.
- Ejemplos reales del repo:
  - `fix: evitar que dev arranque con el dist viejo`
  - `feat: plantas viven en la parcela (reuso en cultivos perennes)`
  - `fix: exigir autenticacion y rol para evitar inyecciones maliciosas`
- **SIN cuerpo.** Solo el subject. El usuario lo pidió explícitamente tras ver
  2 commits con cuerpo largo: *"que no tenga descripcion... no tan largo ni
  extenso"*. No añadir cuerpo aunque el estilo de git sugiera.
- Antes de commitear: `git log --oneline -20` y **copiar el estilo de ahí**.

---

## 1. Qué es este proyecto

Trazabilidad e integridad de datos agrícolas con registro inmutable en Polygon.
El técnico captura en campo → SHA-256 se calcula **en el dispositivo** → el
servidor lo **recalcula** → si difiere, detecta adulteración.

Normativa: **ICA Res. 3168/2015 · NTC 5400 (BPA) · INVIMA · EUDR 2023/1115 · STBN**.

### Monorepo

| Paquete | Stack | Puerto |
|---|---|---|
| `apps/api` | Fastify 5 + zod + ethers 6 | 3001 |
| `apps/web` | Next.js 14 App Router + Tailwind | 3000 |
| `packages/contracts` | Solidity 0.8.28 + Hardhat, Polygon Amoy 80002 | — |
| `packages/database` | PostgreSQL 16, **SQL a mano sin ORM**, 35 tablas | 5434 |
| `packages/shared` | tipos y constantes | — |

> `apps/mobile` (Expo) **fue eliminado** el 2026-09-28. El cliente móvil será un
> proyecto Flutter aparte. Ver §5.

---

## 2. Cómo correrlo

```powershell
cd "C:\Users\alejo\Documents\Flutter projects\agrochain-certificacion"
pnpm install
docker compose up -d postgres    # 1 sola vez: corre los 7 .sql, crea rol + 35 tablas
pnpm db:seed
pnpm dev
```

- **Web:** http://localhost:3000
- **API:** http://localhost:3001 → ver `/health` (no tiene ruta en `/`, el 404 es correcto)
- **Login:** `admin@agrochain.co` / `password123` (hay 8 usuarios en el seed)

**No hace falta ningún `.env`.** Todos los valores tienen defaults hardcodeados:

| Variable | Default | Dónde |
|---|---|---|
| `DATABASE_URL` | `postgresql://agrochain_app:agrochain_app_dev@localhost:5434/agrochain_db` | `packages/database/src/db/client.ts:5-7` |
| `JWT_SECRET` | `dev-secret-cambiar-en-produccion` | `apps/api/src/index.ts:38` |
| `API_URL` / `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | `apps/web/src/lib/api.ts:8`, `client.ts:5` |
| `CORS_ORIGIN` | `*` | `index.ts:33` |

El default de la BD coincide con el rol que crea `packages/database/sql/00_schema.sql:10-19`.

---

## 3. Estado: hecho

### 2026-10-06 — Blockchain real en Polygon Amoy + flujo end-to-end

- **Decisión:** usar Polygon Amoy (80002) **real**, NO Hardhat local. El cliente
  debe ver la firma en `amoy.polygonscan.com`. Los 3 contratos ya están
  deployados y verificados; **NO redesplegar**. Direcciones en `apps/api/.env`
  (`CONTRACT_LOTE_REGISTRY` / `CONTRACT_CERTIFICADO_NFT` / `CONTRACT_ROLE_MANAGER`).
  RPC estable: `https://polygon-amoy-bor-rpc.publicnode.com` (el oficial da
  `ENOTFOUND`).
- **RPC/config:** `polgon.config.ts` sin `gasPrice` fijo (commit `24f58fa`).
- **Bug JWT (ya resuelto):** la API firmaba con un secreto aleatorio de
  `apps/api/.env` y el web verificaba con el default → login devolvía 200 pero
  **no navegaba**. Solución: `apps/web/.env.local` con el **mismo `JWT_SECRET`**.
  Si se pisa ese archivo, vuelve el bug. **Nunca definir `DATABASE_URL`** (el
  default de `client.ts:6` coincide con el rol de `00_schema.sql`).
- **Bug de nonce (commit `23d85dc`):** `inspecciones.ts` llamaba
  `finalizarInspeccionOnChain` directo, saltándose `writer.ts`, y chocaba con el
  cierre de campaña que sí encolaba → carrera de nonce. Fix: nuevo
  `enqueueAsync()` en `writer.ts` (encola y devuelve la promesa) y los dos
  handlers de `inspecciones.ts` usan esa cola. `completar` ahora expone
  `blockchainError` en vez de tragarlo con `console.error`.
- **Flujo completo demostrado** sobre lote `COL-05-2024-00001`
  (`031b3163-66cf-4282-975f-bc5ed7f23623`): hash válido aceptado + adulterado
  rechazado, registro on-chain, campaña cerrada, inspección anclada,
  certificado `CERT-2026-BPA-0001` con **NFT tokenId=2**. Verificado que
  `dataHash` de la BD = on-chain byte a byte.
- **El portal público `/api/verificar/:codigoLote`** devuelve 14 campos
  poblados (incluye `blockchain.explorerUrl` y `certificado.tokenId`).

### 2026-09-28 — Eliminación de `apps/mobile` (Expo)

- **Razón:** el cliente móvil será un proyecto Flutter separado. El módulo Expo
  (5.800 líneas) no se iba a mantener.
- **Nada dependía de él** — verificado: ni api, ni web, ni packages.
- **Preservado antes de borrar:** `docs/HASH_CLIENT_CONTRACT.md`, con la
  implementación de referencia del hashing cliente, las reglas de canonicalización
  y la checklist de paridad para el port a Dart.
- **`pnpm install`** → -679 paquetes.
- **`pnpm turbo run typecheck`** → 4/4 OK. Antes fallaba (ver abajo).

### 2026-09-28 — Arreglo de typecheck de `packages/contracts`

Dos errores preexistentes (verificados con `git stash` sobre el estado original):

1. `TS2688: Cannot find type definition file for 'minimatch'` — el tsconfig no
   declaraba `types`, así que TS arrastraba todos los `@types/*` y `minimatch`
   es un stub roto. Fix: `"types": ["node"]`, igual que ya tenía `shared`.
2. `TS2307: Cannot find module '../typechain-types'` — artefactos que genera
   `hardhat compile` y no existen todavía. Fix: excluir `test/` del tsconfig de
   typecheck; Hardhat compila los tests con su propio config.

### 2026-09-28 — Paso 1: `POST /api/sync/eventos` cerrado (CWE-862)

- **Vulnerabilidad corregida:** el endpoint no exigía token y tomaba `tecnicoId`
  del body. Cualquiera, sin credencial, insertaba eventos haciéndose pasar por
  cualquier técnico — y como el servidor recalcula el hash, **el ataque pasaba la
  verificación de integridad**.
- Cambio único en `apps/api/src/routes/sync.ts` (+19/-4). 6 puntos:
  1. `preHandler: [authenticate, requireRole("TECNICO","ADMIN","INSPECTOR_ICA","INSPECTOR_BPA")]`
  2. `tecnicoId` del schema zod pasa a `.optional()` — ya no es fuente de verdad
  3. `const auth = request.user as JwtPayload` (nombre `auth` a propósito: `payload` ya está en uso en el loop)
  4. Guard 0 en el loop: si `payload.tecnicoId` viene y no es `auth.sub`, se rechaza ese evento con motivo explícito. Va **dentro** del loop para que un evento malo no tumbe los otros 49 del lote.
  5. `verificarHashEvento` recalcula con `auth.sub` (línea 75)
  6. `createEventoProduccion` atribuye con `auth.sub` (línea 138)
- **El cliente Flutter no se rompe:** su `sub` del JWT **es** el `tecnicoId` que
  ya mandaba (`routes/auth.ts:112` firma `sub: usuario.id`), así que el guard
  pasa y el hash recalculado da el mismo string. Byte a byte igual.
- **Roles: los 4 acordados.** `CONSUMIDOR` excluido siempre (es el usuario
  externo del portal público). Ampliar la lista es agregar un rol a una línea.
- Se usa el `authenticate` **importado** de `middleware/auth.ts`, que manda 401
  correcto, y no el decorator (ver Paso 7).
- `pnpm --filter @agrochain/api typecheck` → exit 0. Verificado sin devserver.

---

## 4. Estado: pendiente (Fase 0 — seguridad y bloqueantes)

Orden acordado. **Paso a paso, uno por uno.**

### [x] Paso 2 — Endpoints sin autenticación (hecho en `29d1a2c` + `26932b5`)
`GET /api/lotes/:id`, `GET /api/lotes/codigo/:codigo`, `GET /api/eventos` →
autenticados y acotados por rol. `/api/verificar/:codigoLote` **sí** queda
público (portal del consumidor).

### [x] Catálogo — se queda PÚBLICO (decidido 2026-10-06)
`GET /api/catalogo/{paises,departamentos,municipios,especies}`: solo lectura
sobre tablas estáticas, sin datos de usuarios. **Protegerlas rompería el web**:
`apps/web/src/lib/ubicacion.ts:21` y `catalogoEspecies.ts:13` hacen `fetch`
**sin header de autorización** y devuelven `[]` si la respuesta no es `ok` →
los selects de país/departamento/municipio/especie quedarían vacíos.
Además `apps/api/test/auth.test.ts:101` las exige públicas. No tocar.

### [ ] Paso 3 — `amplify.yml:10` roto
Llama `pnpm --filter @agrochain/database db:generate`, script inexistente.
El deploy web falla. Cambiar por `build`.

### [ ] Paso 4 — `apps/api/.env.example` obsoleto
Apunta a `file:../../packages/database/dev.db` (SQLite) y expone `PINATA_JWT`.
Si alguien lo copia, la API no arranca. Borrar; el `.env.example` raíz es la
fuente única.

### [ ] Paso 5 — `next.config.mjs:7-13`
`ignoreBuildErrors: true` y `ignoreDuringBuilds: true` → desactivar.

### [x] Paso 6 — `turbo.json` fantasma (hecho en `c9bb35c`)
Borradas las tareas fantasma de Prisma: `db:generate`, `db:push`, `db:studio`.

### [ ] Paso 7 — `index.ts:42-48` devuelve 500 en vez de 401
El decorator `app.authenticate` hace `reply.send(err)` **sin `.status()`**. Un
request sin token probablemente responde **500**, no 401, en las **15 rutas**
protegidas. Dos caminos: cambiar el decorator (arregla las 15 de una) o
migrar todas a `import { authenticate } from "../middleware/auth.js"`, que sí
manda 401. Decidido: **paso aparte**, no mezclar con seguridad de sync.
Ojo: `sync.ts` ya usa el importado, no el decorator.

### [x] Paso 8 — Tests de API (hecho en `939b5b5`, ampliado después)
Ahora hay **23 tests de API** (`apps/api/test/auth.test.ts`,
`apps/api/test/alcance.test.ts`) + 31 de contratos. `pnpm turbo run test`.
Sigue **sin CI**. Falta el test de paridad de hash servidor-vs-cliente (§5, riesgo nº1).

---

## 5. Decisiones tomadas (no volver a debating)

1. **Cliente móvil → Flutter, proyecto aparte.** El módulo Expo se borró. La
   paridad de hashing es el riesgo nº1: si Flutter no reproduce byte a byte
   `packages/database/src/lib/hash.ts`, el servidor rechaza todos los syncs.
   Especificación en `docs/HASH_CLIENT_CONTRACT.md`.
2. **Infra 100% local, sin cuentas cloud.** MinIO para S3, nodo Hardhat para
   Polygon, bcrypt en vez de Cognito.
3. **Cada dev con su propio `docker-compose`** → parametrizar puertos.
4. **Tests antes de decidir arquitectura.** No reescribir a ciegas.

---

## 6. Deuda técnica conocida

- **IPFS es fachada.** No hay cliente, ni Pinata, ni SDK. Solo columnas
  `ipfs_cid` heredadas y comentarios. La evidencia real va a **S3**.
- **`altitudMsnm` se acepta y se descarta.** Está en el schema de `sync.ts` y en
  `SyncPayload`, pero **no** se pasa a `createEventoProduccion` ni entra en
  `verificarHashEvento`. Un técnico puede mandar cualquier altitud y el sistema
  no la registra ni la verifica. Decidir: meterla en el hash (rompe paridad con
  el hashing ya desplegado) o sacarla del contrato.
- **README.md miente.** Documenta Prisma, Turso/libSQL, SQLite, IPFS y Pinata.
  Nada existe en el runtime. También dice `pnpm db:push` / `db:studio`, que no
  existen.
- **`pnpm.overrides` muerto en `package.json`.** pnpm 10 lo ignora (warning en
  cada comando). **NO "arreglarlo"**: si se移到 `pnpm-workspace.yaml` forzaría
  React 18 sobre el móvil, que necesita 19. Lo correcto es **borrarlo** (ya se
  hizo el 2026-09-28).
- **`sync.ts` sin idempotency-key** → reintentos del cliente pueden duplicar.
- **Cola blockchain en memoria**, no persistente (el tx va a `lotes.tx_registro`
  / `inspecciones.tx_hash` / `certificados.tx_emision`).
- **`blockchain_txs` es tabla muerta.** Definida en `00_schema.sql:402` con
  índice, **nadie la escribe**. Ojo: `estado_tx` (`00_schema.sql:74`) solo la
  usa esta tabla. Decidir: borrar (tipo + tabla + migración `14_`) o empezar a
  llenarla desde `writer.ts` (ahí estaría el cimiento de la cola persistente).
- **Sin CI.**
- **Clave privada filtrada en el repo hermano** `sse-sistema-seguimiento/scripts/seed.ts:18`.
  Rotar + limpiar historial.
- **Wallet del backend firma por todos** → la cadena prueba *qué* y *cuándo*, no *quién*.

---

## 7. Gotchas de este entorno

- **`drawio-mcp-server` ocupaba el puerto 3000.** Resuelto 2026-09-28: el usuario
  le puso `--http-port 3005` en `~/.config/opencode/opencode.jsonc`. Si vuelve a
  aparecer un `EADDRINUSE: 3000`, es ese.
- **No dejar procesos de devserver en background.** El usuario lo prohibió
  explícitamente: si un comando no termina en <2 min, cancelarlo.
- `ANDROID_HOME` sin definir; Java 8 instalado (Android necesita 17+).
- Flutter 3.47.0 / Dart 3.13.0 disponible.

---

## 8. Comandos de verificación

```powershell
pnpm turbo run typecheck     # 6/6 OK
pnpm turbo run test          # 23 API + 31 contratos
pnpm db:seed                 # carga departamentos, NTC 5400, STBN, 8 usuarios, 2 lotes, campaña
git status --short           # debe estar limpio antes de commitear
```
