# INFORME TÉCNICO
## AgroChain — Sistema de Certificación de Cultivos con Trazabilidad Blockchain

**Versión**: 1.0
**Fecha**: 17 de marzo de 2026
**Clasificación**: Confidencial

---

## Tabla de contenido

1. [Introducción](#1-introducción)
2. [Desarrollo del documento](#2-desarrollo-del-documento)
   - 2.1. [Objetivo](#21-objetivo)
   - 2.2. [Arquitectura General del Sistema](#22-arquitectura-general-del-sistema)
   - 2.3. [Contrato Inteligente (Smart Contract)](#23-contrato-inteligente-smart-contract)
   - 2.4. [Base de Datos Relacional (Off-Chain)](#24-base-de-datos-relacional-off-chain)
   - 2.5. [API Backend y Endpoints](#25-api-backend-y-endpoints)
   - 2.6. [Interfaz de Usuario (Dashboard)](#26-interfaz-de-usuario-dashboard)
   - 2.7. [Conclusión](#27-conclusión)
3. [Anexos](#3-anexos)
4. [Firmas](#4-firmas)

---

## 1. Introducción

AgroChain es un sistema de certificación agrícola diseñado para garantizar la **trazabilidad e integridad** de los datos de cultivo desde el campo hasta el consumidor final, cumpliendo con la normativa colombiana vigente: **ICA Resolución 3168/2015**, **NTC 5400 - Buenas Prácticas Agrícolas (BPA)** e **INVIMA Inocuidad Alimentaria**.

El sistema opera bajo una arquitectura **off-chain / on-chain**: los datos agronómicos se almacenan en una base de datos relacional (off-chain) y su integridad se certifica mediante hashes SHA256 registrados permanentemente en la red blockchain **Polygon Amoy (chainId 80002)**. Esto permite que cualquier alteración posterior a la firma sea técnicamente detectable y quede registrada para auditoría forense.

El proyecto está construido como un **monorepo** administrado con Turborepo y pnpm, compuesto por tres aplicaciones principales (API backend, app móvil y dashboard web) y dos paquetes compartidos (base de datos y contratos inteligentes).

---

## 2. Desarrollo del documento

### 2.1. Objetivo

El objetivo central del sistema es **garantizar la integridad, autenticidad e inmutabilidad de los registros agrícolas** generados por técnicos de campo, de forma que:

1. Cada aporte individual de un técnico quede firmado criptográficamente mediante un hash SHA256 que incluye: identificador de planta, campaña, técnico, posición, campos registrados, hash de foto, hash de audio, coordenadas GPS y fecha exacta del aporte.

2. Los aportes de cuatro técnicos con posiciones fijas (P1–P4) conformen un **registro completo por planta**, cuyo hash certifica el conjunto.

3. Al cerrar una campaña, el hash de todos los registros completos se registra **on-chain en Polygon**, garantizando que ningún dato puede alterarse sin dejar evidencia detectable.

4. El sistema cumpla con los requisitos documentales de las normas **ICA**, **NTC 5400** e **INVIMA**, habilitando la trazabilidad desde el predio hasta la certificación del lote.

**Objetivos específicos:**

- Operar en modo **offline-first** desde dispositivos móviles en campo, garantizando que los datos no se pierdan sin conexión.
- Automatizar el cierre de campañas y la detección de adulteraciones sin intervención manual.
- Emitir **certificados como NFT ERC-721** en Polygon, transferibles y verificables públicamente.
- Proveer un portal de verificación pública para que consumidores y compradores validen la autenticidad del lote mediante código QR.

---

### 2.2. Arquitectura General del Sistema

El sistema está organizado como un monorepo con la siguiente estructura:

```
CERTIFICACION/
├── apps/
│   ├── api/          → Backend Fastify + TypeScript    (Puerto 3001)
│   ├── mobile/       → React Native + Expo             (Offline-first)
│   └── web/          → Next.js 14                      (Dashboard)
├── packages/
│   ├── contracts/    → Solidity 0.8.28 + Hardhat       (3 contratos)
│   ├── database/     → Prisma v6 + libSQL/Turso        (Schema + seed)
│   └── shared/       → Tipos TypeScript compartidos
├── turbo.json        → Configuración Turborepo v2.3.3
└── pnpm-workspace.yaml
```

**Versiones principales:**

| Tecnología       | Versión          |
|-----------------|------------------|
| Node.js         | ≥ 20.0.0         |
| pnpm            | 10.15.0          |
| Turborepo       | 2.3.3            |
| TypeScript      | 5.7.2            |
| Fastify         | 5.2.1            |
| Prisma          | 6.x              |
| React Native    | 0.81.5           |
| Expo            | 54.0.0           |
| Next.js         | 14               |
| Solidity        | 0.8.28           |
| OpenZeppelin    | v5               |
| Ethers.js       | 6.16.0           |
| Polygon         | Amoy (chainId 80002) |

#### Flujo general de datos

```
 TÉCNICO EN CAMPO (App Móvil)
        │
        │  Registra aporte + foto + audio + GPS
        │  Genera contentHash (expo-crypto SHA256)
        ▼
 SQLite LOCAL (offline-first)
        │
        │  Al recuperar conexión
        ▼
 POST /api/campanas/{id}/registros/{plantaId}/aportes
        │
        │  Servidor verifica contentHash
        ▼
 Turso DB (libSQL cloud)
        │
        │  Cuando 4 técnicos completan todos los registros
        ▼
 Cierre automático campaña
        │
        │  campanaHash = SHA256(todos los registros)
        ▼
 LoteRegistry.sol → Polygon Amoy (INMUTABLE)
```

#### Niveles de integridad

El sistema garantiza integridad en tres niveles:

| Nivel | Hash | Composición |
|-------|------|-------------|
| 1 — Aporte | `contentHashAporte` | plantaId + campanaId + tecnicoId + posicion + campos + fotoHash + audioHash + lat + lon + fechaAporte |
| 2 — Registro | `contentHashRegistro` | SHA256 de los 4 contentHashAporte ordenados por posición |
| 3 — Campaña | `campanaHash` | SHA256 de todos los contentHashRegistro ordenados por plantaId |

El `campanaHash` es el único valor que se registra on-chain. Una vez escrito en Polygon, es **inmutable**. Cualquier modificación en cualquier aporte individual hace que el hash no coincida al re-verificar.

---

### 2.3. Contrato Inteligente (Smart Contract)

**Ubicación:** `packages/contracts/contracts/`
**Framework:** Hardhat
**Lenguaje:** Solidity 0.8.28
**EVM Version:** `cancun` (requerido por OpenZeppelin v5 para la instrucción `mcopy`)
**Optimizaciones:** habilitadas, 200 runs
**Tests:** 31/31 pasando

#### Redes configuradas

| Red         | RPC                                    | chainId | Gas       |
|-------------|----------------------------------------|---------|-----------|
| localhost   | http://127.0.0.1:8545                  | 31337   | automático |
| amoy        | https://rpc-amoy.polygon.technology    | 80002   | 200 gwei  |
| polygon     | https://polygon-rpc.com                | 137     | 50 gwei   |

#### Contrato 1: RoleManager.sol

Gestiona el control de acceso basado en roles para el ecosistema AgroChain. Extiende `AccessControl` de OpenZeppelin.

**Roles definidos:**

```solidity
bytes32 public constant AGRICULTOR_ROLE    = keccak256("AGRICULTOR");
bytes32 public constant INSPECTOR_ICA_ROLE = keccak256("INSPECTOR_ICA");
bytes32 public constant INSPECTOR_BPA_ROLE = keccak256("INSPECTOR_BPA");
bytes32 public constant CERTIFICADORA_ROLE = keccak256("CERTIFICADORA");
bytes32 public constant INVIMA_ROLE        = keccak256("INVIMA");
```

**Funciones principales:**

- `asignarRol(address cuenta, bytes32 rol)` — Solo `DEFAULT_ADMIN_ROLE`
- `revocarRol(address cuenta, bytes32 rol)` — Solo admin
- `esAgricultor(address)`, `esInspectorIca(address)`, `esCertificadora(address)`, `esInvima(address)` — Views de consulta

**Eventos:**

- `RolAsignado(address indexed cuenta, bytes32 indexed rol, address indexed asignadoPor)`
- `RolRevocado(address indexed cuenta, bytes32 indexed rol, address indexed revocadoPor)`

---

#### Contrato 2: LoteRegistry.sol

Registro central de lotes agrícolas y su trazabilidad de eventos en blockchain. Es el punto de entrada principal para el ciclo de vida del lote.

**Estados del lote:**

```solidity
enum EstadoLote {
    REGISTRADO,             // Lote creado
    EN_PRODUCCION,          // Activo en campo
    COSECHADO,              // Cosecha realizada
    INSPECCION_SOLICITADA,  // Solicitud enviada al ICA/BPA
    EN_INSPECCION,          // Inspector asignado
    CERTIFICADO,            // Certificado NFT emitido
    RECHAZADO,              // No cumplió BPA
    REVOCADO                // Certificado revocado
}
```

**Estructura principal:**

```solidity
struct Lote {
    bytes32    dataHash;       // keccak256 de datos off-chain
    address    agricultor;     // Wallet del agricultor
    address    certificadora;  // Asignada al certificar
    EstadoLote estado;
    uint256    creadoEn;       // block.timestamp
    uint256    actualizadoEn;
    bool       existe;
}

struct EventoLog {
    string  tipoEvento;       // "SIEMBRA", "RIEGO", "CONTROL_PLAGAS"...
    bytes32 evidenciaHash;    // keccak256 del hash IPFS
    address registradoPor;    // Wallet del técnico
    uint256 timestamp;
}
```

**Funciones principales:**

| Función | Acceso | Descripción |
|--------|--------|-------------|
| `registrarLote(bytes32 loteId, bytes32 dataHash)` | AGRICULTOR | Registra lote en cadena |
| `registrarEvento(bytes32 loteId, string tipo, bytes32 evidenciaHash)` | AGRICULTOR / INSPECTOR | Agrega evento de producción |
| `solicitarInspeccion(bytes32 loteId)` | Agricultor dueño | Solicita inspección ICA/BPA |
| `iniciarInspeccion(bytes32 loteId)` | INSPECTOR | Asigna inspector |
| `registrarResultadoInspeccion(bytes32 loteId, bool aprobado, bytes32 reporteHash)` | INSPECTOR | Cierra inspección |
| `certificarLote(bytes32 loteId, address certificadora)` | Solo CertificadoNFT | Certifica |
| `revocarCertificado(bytes32 loteId)` | Solo CertificadoNFT | Revoca certificación |
| `setCertificadoNFT(address)` | Admin | Configura contrato NFT (único, inmutable) |

**Eventos emitidos:**

- `LoteRegistrado(bytes32 indexed loteId, address indexed agricultor, bytes32 dataHash, uint256 timestamp)`
- `EventoRegistrado(bytes32 indexed loteId, string tipoEvento, bytes32 evidenciaHash, address registradoPor, uint256 timestamp)`
- `EstadoCambiado(bytes32 indexed loteId, EstadoLote anterior, EstadoLote nuevo, address cambiadoPor, uint256 timestamp)`
- `CertificadoraAsignada(bytes32 indexed loteId, address indexed certificadora, uint256 timestamp)`

---

#### Contrato 3: CertificadoNFT.sol

Implementa el estándar **ERC-721** de OpenZeppelin para la emisión de certificados como tokens no fungibles (NFT) transferibles y verificables en Polygon.

**Tipos de certificado:**

```solidity
enum TipoCertificado {
    BPA_ICA,           // Buenas Prácticas Agrícolas ICA
    ORGANICO,          // Certificación orgánica
    GLOBAL_GAP,        // GlobalG.A.P
    RAINFOREST,        // Rainforest Alliance
    INVIMA_INOCUIDAD   // INVIMA Inocuidad Alimentaria
}
```

**Estructura del certificado:**

```solidity
struct MetadataCertificado {
    bytes32         loteId;            // ID en LoteRegistry
    string          numeroCertificado; // "BPA-ANT-2024-00001"
    TipoCertificado tipo;
    address         certificadora;     // Quién certificó
    address         agricultor;        // Dueño original
    uint256         fechaEmision;      // block.timestamp
    uint256         fechaVencimiento;  // Timestamp vencimiento
    bool            revocado;
}
```

**Controles anti-duplicación:**

- `mapping(bytes32 => bool) public loteYaCertificado` — Impide certificar un lote dos veces
- `mapping(string => bool) public numeroUsado` — Garantiza unicidad del número oficial de certificado

**Funciones principales:**

| Función | Acceso | Descripción |
|--------|--------|-------------|
| `emitirCertificado(bytes32 loteId, string numero, TipoCertificado tipo, uint256 fechaVencimiento)` | CERTIFICADORA | Emite NFT certificado |
| `revocarCertificado(bytes32 loteId, string motivo)` | CERTIFICADORA | Revoca el NFT |
| `verificarCertificado(uint256 tokenId)` | Público | Retorna metadata completa |
| `tokenURI(uint256 tokenId)` | Público | URI a metadata IPFS (ERC721URIStorage) |

**Eventos emitidos:**

- `CertificadoEmitido(uint256 indexed tokenId, bytes32 indexed loteId, address indexed agricultor, string numeroCertificado, TipoCertificado tipo, uint256 fechaVencimiento)`
- `CertificadoRevocado(uint256 indexed tokenId, bytes32 indexed loteId, address revocadoPor, uint256 timestamp)`

---

### 2.4. Base de Datos Relacional (Off-Chain)

**ORM:** Prisma v6 con driver adapter `@libsql/client`
**Motor:** SQLite / Turso (libSQL cloud)
**Desarrollo local:** `file:./dev.db`
**Producción:** Turso cloud (DATABASE_URL con ruta absoluta en Windows)
**Modelos:** 22 modelos relacionales
**Enums:** 19 tipos enumerados

#### Modelos principales

**Usuario** — 8 roles, autenticación JWT

Los usuarios del sistema pueden tener los roles: `AGRICULTOR`, `INSPECTOR_ICA`, `INSPECTOR_BPA`, `CERTIFICADORA`, `INVIMA`, `ADMIN`, `CONSUMIDOR` o `TECNICO`. Cada usuario puede tener una `walletAddress` de Polygon para operaciones on-chain.

**Predio** — Unidad territorial (ICA Res. 3168/2015)

Contiene: `codigoIca` (único), georeferenciación completa (`latitud`, `longitud`, `altitudMsnm`), información de infraestructura (bodega agroquímicos, agua potable, SSS básicas, zona acopio) y área desglosada (total, productiva, bosque, viveros).

**Lote** — Unidad trazable principal (NTC 5400 §3)

Código único formato `COL-{DEP}-{YYYY}-{SEQ}`. Contiene campos de seguimiento agronómico, estado del ciclo (`REGISTRADO` → `CERTIFICADO`), y campos blockchain: `loteIdOnchain` (bytes32), `dataHash`, `txRegistro`, `syncEstado`.

**Planta** — Identificación individual

Código QR/NFC único por planta dentro del lote. Registra: coordenadas GPS propias, especie/variedad, origen material vegetal, procedencia vivero, estado fenológico inicial (altura, diámetro, número de hojas).

**EventoProduccion** — Registro de actividades (NTC 5400 §4.3–4.9)

14 tipos de evento: `PREPARACION_SUELO`, `SIEMBRA`, `FERTILIZACION`, `RIEGO`, `CONTROL_PLAGAS`, `CONTROL_ENFERMEDADES`, `PODA`, `COSECHA`, `POSTCOSECHA`, `MONITOREO`, `OTRO`. Cada evento lleva `contentHash` SHA256 único, estado de verificación y sincronización.

**AplicacionAgroquimico** — Control fitosanitario (NTC 5400 §4.7)

Vinculado a un evento de tipo `CONTROL_PLAGAS` o `CONTROL_ENFERMEDADES`. Registra: `registroIca` (obligatorio), `ingredienteActivo`, `categoriaToxicologica` (5 categorías), `dosisAplicada`, `periodoCarenciaDias`, `fechaUltimaAplicacion`, `fechaCosechaPosible`.

**RegistroRiego** — Gestión hídrica (NTC 5400 §4.5)

Vinculado a evento `RIEGO`. Registra: fuente de agua, método de riego (`GOTEO`, `ASPERSION`, `GRAVEDAD`, `SURCOS`), volumen en m³, duración y CID de análisis de agua en IPFS.

**Campana** — Campaña de visitas multi-técnico

Agrupa un ciclo de registro de todas las plantas de un lote. Estados: `ACTIVA` (en preparación) → `ABIERTA` (técnicos registrando) → `CERRADA` (completa, hash en blockchain). Al cerrarse, almacena el `campanaHash` y el `txHash` de Polygon.

**CampanaTecnico** — Asignación de posiciones

Tabla de unión que asigna cada técnico a una posición fija (1–4) dentro de la campaña y define sus `camposAsignados` (JSON array). Restricciones: una posición por campaña, un técnico por campaña.

**AporteTecnico** — Firma individual de cada técnico (NIVEL 1 de integridad)

El núcleo del sistema de integridad. Cada aporte contiene:
- `campos`: JSON con los valores registrados
- `fotoHash`: SHA256 del archivo de foto
- `audioHash`: SHA256 del archivo de audio
- `latitud`, `longitud`: GPS capturado en el momento
- `fechaAporte`: timestamp exacto ISO 8601
- `contentHash`: SHA256 inmutable de todos los anteriores (`@unique`)
- `hashVerificado`: flag de verificación servidor
- `syncEstado`: `PENDIENTE`, `VERIFICADO`, `EN_CADENA`, `RECHAZADO`

**RegistroPlanta** — Estado por planta en la campaña (NIVEL 2 de integridad)

Consolida los aportes de los 4 técnicos para una planta. Estados:
- `PENDIENTE`: ningún aporte
- `PARCIAL`: entre 1 y 3 aportes
- `COMPLETO`: los 4 técnicos aportaron, `contentHashRegistro` generado
- `ADULTERADO`: hash no coincide al re-verificar
- `INVALIDADO`: adulterado preservado para auditoría forense

**Certificado** — Certificado oficial del lote

Vincula el resultado de la inspección con el NFT emitido en Polygon. Almacena: `numeroCertificado`, `fechaEmision`, `fechaVencimiento`, `nftTokenId`, `txEmision`, `ipfsUri` (metadata IPFS) y `qrCodeUrl`.

**Inspeccion** — Auditoría formal ICA/BPA/INVIMA

Registra el workflow completo: solicitud → programación → realización → resultado. Campos cuantitativos: `puntaje`, `hallazgosCriticos`, `hallazgosMayores`, `hallazgosMenores`. Vinculada al `ChecklistBpa` y `NumeralNtc5400`.

**ChecklistBpa** — Lista de verificación NTC 5400

100+ ítems con referencia a numerales NTC 5400 (ej.: "4.3.1", "4.7.2"). Por cada numeral: si aplica, si cumple, criticidad (`CRITICO`, `MAYOR`, `MENOR`), evidencia CID en IPFS y observación del inspector.

**Documento** — Repositorio IPFS

Archivos vinculados a lotes o eventos. Tipos: `FOTO`, `VIDEO`, `PDF`, `ANALISIS_LABORATORIO`, `CERTIFICADO`, `OTRO`. Contiene `ipfsCid` (único), `hashSha256` y `txHash` de registro on-chain.

**BlockchainTx** — Auditoría de transacciones

Registro de todas las transacciones emitidas hacia Polygon: contrato, método, entidad, estado (`PENDIENTE`, `CONFIRMADO`, `FALLIDO`), bloque, gas usado.

**Otros modelos de referencia colombiana:**
- `Departamento` / `Municipio`: 33 departamentos, ~1100 municipios (códigos DANE)
- `Organizacion`: Certificadoras, ICA, INVIMA, Cooperativas (NIT único)
- `AnalisisSuelo`: pH, N, P, K, Ca, Mg (laboratorio acreditado)

---

### 2.5. API Backend y Endpoints

**Framework:** Fastify 5.2.1
**Lenguaje:** TypeScript 5.7.2
**Puerto:** 3001
**Autenticación:** JWT (`@fastify/jwt` 9.0.3), expiración 7 días
**Validación:** Zod 3.24.1
**Blockchain:** Ethers.js 6.16.0

#### Módulos de rutas (13 archivos)

##### Autenticación

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| POST | `/api/auth/login` | Autenticación con email + contraseña | No |
| GET | `/api/auth/me` | Retorna usuario activo del token | Sí |

El login retorna `{ token, usuario: { id, nombre, email, rol } }`. La contraseña se verifica contra SHA256 (desarrollo) o bcrypt (producción).

##### Usuarios

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/api/usuarios` | Listar (filtro por `?rol=TECNICO`) | ADMIN |
| POST | `/api/usuarios` | Crear usuario | ADMIN |

##### Campañas (módulo principal — ~840 líneas)

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/api/campanas` | Listar campañas (filtro `?loteId=`) | Sí |
| POST | `/api/campanas` | Crear campaña con campos requeridos | ADMIN |
| GET | `/api/campanas/:id` | Detalle + progreso completo | Sí |
| PUT | `/api/campanas/:id/estado` | Cambiar estado (ACTIVA→ABIERTA→CERRADA) | ADMIN |
| POST | `/api/campanas/:id/tecnicos` | Asignar técnico a posición (1-4) | ADMIN |
| GET | `/api/campanas/:id/tecnicos` | Listar técnicos asignados | Sí |
| GET | `/api/campanas/movil/lote/:loteId` | Endpoint app móvil (campaña + posición del técnico autenticado) | TECNICO |
| POST | `/api/campanas/:id/registros/:plantaId/aportes` | Guardar aporte de técnico | TECNICO |
| POST | `/api/campanas/:id/registros/:plantaId/reregistrar` | Anular adulterado y crear nuevo vacío | ADMIN |
| POST | `/api/campanas/:id/verificar-integridad` | Detectar adulteraciones en toda la campaña | Sí |

**Flujo del endpoint de aportes** (`POST .../aportes`):

1. Recibe: `{ campos, fotoHash, audioHash, latitud, longitud, contentHash }`
2. Recupera el `CampanaTecnico` del técnico autenticado → posición asignada
3. Recalcula `contentHash` con el mismo algoritmo del dispositivo
4. Si no coincide: responde 422 con motivo de rechazo
5. Si coincide: guarda `AporteTecnico`, actualiza estado `RegistroPlanta` (PARCIAL → COMPLETO)
6. Si todos los registros = COMPLETO: cierre automático
   - Genera `campanaHash`
   - Registra evento en `LoteRegistry.sol` de Polygon
   - Campaña pasa a estado CERRADA

**Flujo de cambio de estado** (`PUT .../estado`):

- `ACTIVA → ABIERTA`: valida que haya exactamente 4 técnicos con posiciones 1-4 asignadas
- `ABIERTA → CERRADA` automático: se activa cuando todos los registros están COMPLETO
- `ABIERTA → CERRADA` manual: requiere `{ forzar: true }`, permite incompletos (registra advertencia)

##### Lotes

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/api/lotes` | Listar lotes (agricultor ve solo los suyos) | Sí |
| GET | `/api/lotes/:id` | Detalle con eventos e inspecciones | Sí |
| POST | `/api/lotes` | Crear lote (genera código COL-{DEP}-{YYYY}-{SEQ}) | AGRICULTOR |

##### Verificación pública (sin autenticación)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/verificar/:codigoLote` | Trazabilidad completa, eventos, certificado y estado blockchain. Para consumidores vía QR. |

##### Otros módulos

| Módulo | Descripción |
|--------|-------------|
| `eventos.ts` | Registrar eventos de producción en lotes |
| `sync.ts` | Sincronización off-chain → on-chain pendiente |
| `certificados.ts` | Gestión del ciclo de vida de certificados NFT |
| `inspecciones.ts` | Workflow de inspecciones ICA/BPA/INVIMA |
| `predios.ts` | Gestión de predios agrícolas |
| `metricas.ts` | Indicadores para dashboard estadístico |
| `informes.ts` | Generación de reportes exportables |

##### Health

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | `{ status, version, timestamp }` |
| GET | `/api/blockchain/status` | Estado de conexión con nodo Polygon |

---

### 2.6. Interfaz de Usuario (Dashboard)

El sistema cuenta con dos interfaces de usuario: una **aplicación móvil** para técnicos y agricultores en campo, y un **dashboard web** para administradores, inspectores y certificadoras.

#### App Móvil (React Native + Expo)

**Stack:** React Native 0.81.5, Expo 54.0.0, Expo Router, TypeScript 5.3.3
**Dependencias clave:**

| Librería | Versión | Uso |
|---------|---------|-----|
| `expo-sqlite` | 16.0.10 | Base de datos local offline |
| `expo-crypto` | 15.0.8 | Generación SHA256 en dispositivo |
| `expo-camera` | 17.0.10 | Captura de fotos como evidencia |
| `expo-location` | 19.0.8 | GPS automático al guardar |
| `react-hook-form` | 7.54.2 | Formularios de registro |

**Pantallas principales:**

| Pantalla | Archivo | Función |
|---------|---------|---------|
| Login | `(auth)/login.tsx` | Autenticación, guarda sesión + posición en SQLite |
| Mis Campañas | `(tabs)/mis-campanas.tsx` | Lista campañas ABIERTA del técnico |
| Mis Lotes | `(tabs)/mis-lotes.tsx` | Lotes disponibles para el agricultor |
| Sincronización | `(tabs)/sync.tsx` | Estado de aportes pendientes, botón sincronizar |
| Verificar | `(tabs)/verificar.tsx` | Escáner QR para verificar lotes |
| Detalle Campaña | `campana-detalle.tsx` | Lista de plantas con estado por técnico |
| Detalle Planta | `detalle-planta.tsx` | Morfología actual de la planta |
| **Registrar Aporte** | `registrar-aporte.tsx` | **Formulario principal de campo** |
| Registrar Evento | `registrar-evento.tsx` | Eventos de producción simples |

**Formulario Registrar Aporte** (pantalla core del sistema):

- Carga dinámicamente solo los `camposAsignados` del técnico autenticado
- Captura GPS automáticamente al abrir la pantalla
- Permite adjuntar foto (expo-camera) y/o audio según campos asignados
- Genera `contentHash = SHA256(plantaId + campanaId + tecnicoId + posicion + campos + fotoHash + audioHash + lat + lon + fechaAporte)`
- Guarda en SQLite local (tabla `aportes_pendientes`) — funciona sin conexión
- La pantalla de Sincronización envía los pendientes al servidor cuando hay red

**Modo offline-first:**

```
 App abre                     → carga campaña desde servidor (si hay red)
 Técnico llena formulario     → guarda en SQLite local
 Técnico da "Sincronizar"     → POST al servidor, verifica hashes
 Servidor rechaza (hash falla)→ marcado como rechazado con motivo
 Servidor acepta              → eliminado de pendientes locales
```

**Sesión persistente en SQLite:**

La tabla `sesion` almacena: `userId`, `nombre`, `email`, `rol`, `token`, `posicion`, `camposAsignados` (JSON) y `apiUrl`. Al reiniciar la app, la sesión se restaura automáticamente.

---

#### Dashboard Web (Next.js 14)

**Stack:** Next.js 14, TypeScript, App Router, Server Components + Client Components

**Páginas principales:**

| Sección | Ruta | Descripción |
|---------|------|-------------|
| Panel principal | `/` | Resumen estadístico |
| Campañas | `/campanas` | Lista con estado y progreso |
| Detalle campaña | `/campanas/[id]` | Progreso por planta, aportes de técnicos |
| Lotes | `/lotes` | Gestión completa de lotes |
| Predios | `/predios` | Registro y edición de predios |
| Inspecciones | `/inspecciones` | Workflow ICA/BPA con checklist |
| Certificados | `/certificados` | NFT emitidos y revocados |
| Usuarios | `/usuarios` | Gestión de roles y perfiles |

**Componentes clave:**

- `AccionesCampana.tsx` — Botones de transición de estado (ACTIVA → ABIERTA → CERRADA), con validación de técnicos asignados y advertencia al forzar cierre con incompletos
- `RegistroExpandible.tsx` — Vista colapsable por planta con aportes de cada técnico, campo por campo, con indicadores de estado (COMPLETO / PARCIAL / ADULTERADO)

**Acciones del panel de campaña:**

1. Ver progreso: N plantas COMPLETO / N PARCIAL / N PENDIENTE / N ADULTERADO
2. Asignar técnicos a posiciones (1-4) con campos configurables
3. Abrir campaña (ACTIVA → ABIERTA)
4. Forzar cierre manual con advertencia (cuando hay incompletos)
5. Ver `campanaHash` y link al explorador de Polygon

---

### 2.7. Conclusión

AgroChain es una solución técnicamente sólida que resuelve el problema de la **confianza y la trazabilidad** en la certificación agrícola colombiana mediante tres pilares:

**1. Firma criptográfica en campo:**
Cada técnico genera un hash SHA256 inmutable de su aporte antes de sincronizar. El hash incluye sus datos, evidencias (foto, audio) y su ubicación GPS. Esto garantiza que el dato no puede modificarse una vez generado sin que la discrepancia sea detectable.

**2. Arquitectura multi-técnico con verificación cruzada:**
Cuatro técnicos con posiciones fijas registran campos complementarios para cada planta. El servidor recalcula independientemente el hash de cada aporte y lo compara con el enviado. Si no coincide, el registro queda marcado como ADULTERADO para auditoría forense. Un registro COMPLETO requiere los 4 aportes verificados.

**3. Registro on-chain inmutable:**
Al cerrar una campaña, el `campanaHash` (SHA256 de todos los registros) se registra en el contrato `LoteRegistry.sol` de Polygon Amoy. Una vez en blockchain, ningún valor de la cadena hash puede alterarse retroactivamente. El certificado final se emite como NFT ERC-721 transferible y verificable públicamente.

El sistema cumple con los requisitos documentales de las normas ICA Res. 3168/2015, NTC 5400 y certificaciones INVIMA, y provee un portal de verificación pública por QR para consumidores y compradores internacionales.

**Estado actual del proyecto:**
- Contratos desplegables en Polygon Amoy (31/31 tests)
- API backend funcional con todos los endpoints
- App móvil offline-first con formulario dinámico por técnico
- Dashboard web con gestión completa de campañas y certificados
- Datos de prueba: 4 técnicos, 2 lotes, 10 plantas/lote, campaña ABIERTA

---

## 3. Anexos

### Anexo A — Algoritmo de integridad SHA256

El algoritmo es **idéntico** en backend (Node.js crypto) y app móvil (expo-crypto), garantizando verificación cruzada. El orden de los campos es determinista mediante `sortObject()` recursivo.

```typescript
// Payload del contentHashAporte (nivel 1)
{
  plantaId:   string,          // ID interno Prisma
  campanaId:  string,          // ID interno Prisma
  tecnicoId:  string,          // ID interno Prisma
  posicion:   number,          // 1 | 2 | 3 | 4
  campos:     object (sorted), // { alturaCm: 120, diametroTalloCm: 4.5 }
  fotoHash:   string | null,   // SHA256(archivo foto) o null
  audioHash:  string | null,   // SHA256(archivo audio) o null
  latitud:    number | null,   // GPS técnico en el momento
  longitud:   number | null,
  fechaAporte: string          // "2026-03-17T10:30:00.000Z" (ISO 8601 exacto)
}
→ SHA256(JSON.stringify(sorted_payload))
```

### Anexo B — Datos de prueba (seed)

Al ejecutar `pnpm db:seed`, el sistema carga:

| Entidad | Cantidad | Detalle |
|---------|---------|---------|
| Departamentos Colombia | 33 | Códigos DANE oficiales |
| Municipios Colombia | ~1100 | Todos los municipios |
| Numerales NTC 5400 | 100+ | Checklist BPA completo |
| Organizaciones | 1 | AgroCert Colombia S.A.S (NIT 900123456-7) |
| Admin | 1 | admin@agrochain.co |
| Agricultor | 1 | agricultor@agrochain.co — Carlos Alberto Gomez Zapata |
| Inspector BPA | 1 | m.torres@ica.gov.co — Maria Fernanda Torres Rincon |
| Técnicos | 4 | tecnico1-4@agrochain.co |
| Predios demo | 1 | Con georeferenciación ICA |
| Lotes demo | 2 | COL-05-2024-00001 (Mango + Café) |
| Plantas por lote | 10 | Con código QR simulado |
| Campaña demo | 1 | Estado ABIERTA, 4 técnicos asignados |

Contraseña de todos los usuarios de prueba: `password123`

### Anexo C — Comandos principales del proyecto

```bash
# Instalar dependencias
pnpm install

# Sincronizar schema a base de datos
pnpm db:push

# Cargar datos de prueba Colombia + campaña demo
pnpm db:seed

# Iniciar Prisma Studio (interfaz visual DB)
pnpm db:studio

# Arrancar todo en paralelo (API + Web + Mobile)
pnpm dev

# Solo API backend
pnpm --filter @agrochain/api dev

# Compilar contratos
pnpm --filter @agrochain/contracts compile

# Ejecutar tests contratos
pnpm --filter @agrochain/contracts test

# Desplegar contratos en Amoy
pnpm --filter @agrochain/contracts deploy:amoy

# Reset completo de base de datos (DESTRUCTIVO)
# Requiere confirmación explícita
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="si" \
  ../../node_modules/.bin/prisma db push --force-reset
```

### Anexo D — Variables de entorno requeridas

**apps/api/.env:**
```
DATABASE_URL="file:C:/Proyectos/WINDOWS/POLYGON/CERTIFICACION/packages/database/dev.db"
JWT_SECRET="clave-secreta-desarrollo"
PINATA_API_KEY="..."
PINATA_SECRET_KEY="..."
POLYGON_RPC_URL="https://rpc-amoy.polygon.technology"
DEPLOYER_PRIVATE_KEY="0x..."
ROLE_MANAGER_ADDRESS="0x..."
LOTE_REGISTRY_ADDRESS="0x..."
CERTIFICADO_NFT_ADDRESS="0x..."
```

### Anexo E — Normativa colombiana implementada

| Norma | Entidad | Aspectos implementados |
|-------|---------|----------------------|
| Resolución 3168/2015 | ICA | Registro de predios, codigoIca, trazabilidad material vegetal, procedencia vivero |
| NTC 5400 BPA | ICONTEC | 100+ numerales de checklist, criticidad por hallazgo, plan de mejora, tipos de inspección |
| INVIMA Inocuidad | INVIMA | Tipo certificado INVIMA_INOCUIDAD, análisis laboratorio, periodo carencia agroquímicos |

---

## 4. Firmas

El presente informe técnico ha sido elaborado como documentación del sistema AgroChain v1.0.

---

| Rol | Nombre | Firma | Fecha |
|-----|--------|-------|-------|
| Líder Técnico | | | |
| Arquitecto de Software | | | |
| Responsable de Base de Datos | | | |
| Responsable Blockchain | | | |
| Revisor / Auditor | | | |

---

*Documento generado el 17 de marzo de 2026.*
*AgroChain — Sistema de Certificación Agrícola con Trazabilidad Blockchain*
*Versión del sistema: 1.0.0 — Polygon Amoy (chainId 80002)*
