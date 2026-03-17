# 🌿 AgroChain — Certificación Agrícola On/Off-Chain

> Sistema de trazabilidad e integridad de datos agrícolas con registro inmutable en **Polygon Blockchain**.
> Cumple normativa colombiana: **ICA Res. 3168/2015 · NTC 5400 BPA · INVIMA Inocuidad**.

---

## ¿Qué problema resuelve?

En la certificación agrícola tradicional, los datos de campo pueden ser alterados antes de llegar al ente certificador. **AgroChain** resuelve esto mediante firma criptográfica en el dispositivo del técnico:

```
Técnico registra dato en campo
        ↓
SHA256(dato + foto + audio + GPS + fecha) = contentHash INMUTABLE
        ↓
4 técnicos firman → contentHashRegistro por planta
        ↓
Todos los registros → campanaHash
        ↓
campanaHash registrado en Polygon Blockchain (INMUTABLE PARA SIEMPRE)
```

Cualquier alteración posterior hace que el hash no coincida → detección automática de adulteración.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Blockchain** | Polygon Amoy (chainId 80002) · Solidity 0.8.28 · OpenZeppelin v5 |
| **Smart Contracts** | Hardhat · RoleManager · LoteRegistry · CertificadoNFT (ERC-721) |
| **Backend** | Fastify 5 · TypeScript · JWT · Zod · Ethers.js 6 |
| **Base de datos** | Prisma v6 · libSQL (Turso) · SQLite |
| **App Móvil** | React Native 0.81 · Expo 54 · expo-sqlite · expo-crypto |
| **Dashboard Web** | Next.js 14 · App Router · Tailwind CSS |
| **Monorepo** | Turborepo · pnpm workspaces |
| **IPFS** | Pinata (evidencias fotográficas) |

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                     CAMPO (offline-first)                   │
│  📱 App Móvil React Native + Expo                           │
│  • 4 técnicos, posiciones fijas (P1-P4)                     │
│  • SHA256 generado en dispositivo antes de sincronizar      │
│  • SQLite local — funciona sin conexión                     │
└──────────────────────────┬──────────────────────────────────┘
                           │ POST /api/campanas/.../aportes
                           │ (verifica hash, rechaza si adulterado)
┌──────────────────────────▼──────────────────────────────────┐
│                   API BACKEND (Fastify)                     │
│  • Recalcula SHA256 y compara con el enviado                │
│  • PARCIAL → COMPLETO cuando 4 técnicos aportan             │
│  • Cierre automático cuando todas las plantas = COMPLETO    │
└──────────┬─────────────────────────────┬────────────────────┘
           │                             │
┌──────────▼──────────┐    ┌─────────────▼──────────────────┐
│  Turso DB (libSQL)  │    │  Polygon Amoy Blockchain        │
│  22 modelos Prisma  │    │  campanaHash (INMUTABLE)        │
│  Off-chain data     │    │  Certificados NFT ERC-721       │
└─────────────────────┘    └────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────┐
│                 DASHBOARD WEB (Next.js 14)                  │
│  • Panel campañas con progreso por planta                   │
│  • Gestión técnicos, lotes, inspecciones, certificados      │
│  • Portal público de verificación por QR                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Integridad de Datos en 3 Niveles

### Nivel 1 — contentHashAporte (por técnico)
```
SHA256({
  plantaId, campanaId, tecnicoId, posicion,
  campos: { alturaCm, diametroTalloCm, ... },
  fotoHash, audioHash,
  latitud, longitud,
  fechaAporte  ← ISO 8601 exacto
})
```

### Nivel 2 — contentHashRegistro (por planta)
```
SHA256( aportes de los 4 técnicos ordenados por posición )
```

### Nivel 3 — campanaHash (campaña completa → ON-CHAIN)
```
SHA256( todos los contentHashRegistro ordenados por plantaId )
→ Registrado en LoteRegistry.sol · Polygon Amoy
```

---

## Smart Contracts

| Contrato | Descripción |
|---------|-------------|
| `RoleManager.sol` | Control de acceso: AGRICULTOR, INSPECTOR_ICA, INSPECTOR_BPA, CERTIFICADORA, INVIMA |
| `LoteRegistry.sol` | Registro de lotes y eventos on-chain. 8 estados: REGISTRADO → CERTIFICADO |
| `CertificadoNFT.sol` | ERC-721. 5 tipos: BPA_ICA, ORGANICO, GLOBAL_GAP, RAINFOREST, INVIMA_INOCUIDAD |

```
31/31 tests pasando ✅
Red: Polygon Amoy (chainId 80002)
```

---

## Normativa Colombiana Implementada

| Norma | Entidad | Aspectos |
|-------|---------|---------|
| **Resolución 3168/2015** | ICA | Registro de predios, `codigoIca`, trazabilidad material vegetal |
| **NTC 5400 BPA** | ICONTEC | 100+ numerales de checklist, criticidad CRITICO/MAYOR/MENOR |
| **INVIMA Inocuidad** | INVIMA | Certificado inocuidad, análisis laboratorio, periodos de carencia |

---

## Estructura del Monorepo

```
agrochain-certificacion/
├── apps/
│   ├── api/          → Backend Fastify + TypeScript    (puerto 3001)
│   ├── mobile/       → React Native + Expo             (offline-first)
│   └── web/          → Next.js 14 Dashboard
├── packages/
│   ├── contracts/    → Solidity + Hardhat              (3 contratos)
│   ├── database/     → Prisma schema + seed            (22 modelos)
│   └── shared/       → Tipos TypeScript compartidos
├── turbo.json
└── pnpm-workspace.yaml
```

---

## Inicio Rápido

### Requisitos
- Node.js ≥ 20
- pnpm ≥ 9

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/caat-at/agrochain-certificacion.git
cd agrochain-certificacion

# Instalar dependencias
pnpm install

# Configurar variables de entorno
cp apps/api/.env.example         apps/api/.env
cp packages/contracts/.env.example  packages/contracts/.env
cp packages/database/.env.example   packages/database/.env
cp apps/web/.env.example         apps/web/.env.local

# Inicializar base de datos
pnpm db:push
pnpm db:seed

# Arrancar todo
pnpm dev
```

### Comandos útiles

```bash
pnpm db:push       # Sincronizar schema Prisma
pnpm db:seed       # Cargar datos Colombia + campaña demo
pnpm db:studio     # Prisma Studio (interfaz visual DB)
pnpm dev           # Arrancar API + Web en paralelo

# Contratos
pnpm --filter @agrochain/contracts compile
pnpm --filter @agrochain/contracts test
pnpm --filter @agrochain/contracts deploy:amoy
```

### Usuarios de prueba (después del seed)

| Rol | Email | Contraseña |
|-----|-------|-----------|
| Admin | admin@agrochain.co | password123 |
| Agricultor | agricultor@agrochain.co | password123 |
| Inspector BPA | m.torres@ica.gov.co | password123 |
| Técnico 1 | tecnico1@agrochain.co | password123 |
| Técnico 2 | tecnico2@agrochain.co | password123 |
| Técnico 3 | tecnico3@agrochain.co | password123 |
| Técnico 4 | tecnico4@agrochain.co | password123 |

---

## Flujo de una Campaña

```
1. ADMIN crea campaña en lote        → estado ACTIVA
2. ADMIN asigna 4 técnicos (P1-P4)   → campos por posición
3. ADMIN abre campaña                → estado ABIERTA
4. Técnicos registran en campo       → offline-first, hash en dispositivo
5. Sincronizan cuando hay red        → servidor verifica cada hash
6. Al completar todas las plantas    → cierre AUTOMÁTICO
7. campanaHash registrado on-chain   → Polygon (INMUTABLE)
8. Inspector audita → Certificado    → NFT ERC-721 emitido
```

---

## Variables de Entorno

Cada app tiene su `.env.example`. Los archivos `.env` reales **nunca se commitean**.

```bash
apps/api/.env.example          # JWT, DB, Pinata, wallet, contratos
packages/contracts/.env.example # Clave deployer, RPCs, PolygonScan
packages/database/.env.example  # DATABASE_URL (local o Turso cloud)
apps/web/.env.example           # API URL, JWT secret
```

---

## Licencia

Proyecto privado — todos los derechos reservados © 2026 AgroChain
