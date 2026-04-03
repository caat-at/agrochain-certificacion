/**
 * Servicio blockchain para AgroChain.
 * Conecta la API con los contratos LoteRegistry y CertificadoNFT en Polygon Amoy.
 *
 * Flujo:
 *  1. registrarLoteOnChain        — LoteRegistry.registrarLote(loteId, dataHash)
 *  2. registrarEventoOnChain      — LoteRegistry.registrarEvento(loteId, tipo, hash)
 *  3. finalizarInspeccionOnChain  — LoteRegistry.solicitarInspeccion + iniciarInspeccion + finalizarInspeccion
 *  4. emitirCertificadoOnChain    — CertificadoNFT.emitirCertificado(...)
 *  5. revocarCertificadoOnChain   — CertificadoNFT.revocarCertificado(tokenId, hash)
 */
import { ethers } from "ethers";

// ── ABIs mínimos (solo funciones que usamos) ─────────────────────────────────

const LOTE_REGISTRY_ABI = [
  "function registrarLote(bytes32 loteId, bytes32 dataHash) external",
  "function registrarEvento(bytes32 loteId, string calldata tipoEvento, bytes32 evidenciaHash) external",
  "function solicitarInspeccion(bytes32 loteId) external",
  "function iniciarInspeccion(bytes32 loteId) external",
  "function registrarResultadoInspeccion(bytes32 loteId, bool aprobado, bytes32 reporteHash) external",
  "function lotes(bytes32) external view returns (bytes32 dataHash, address agricultor, address certificadora, uint8 estado, uint256 creadoEn, uint256 actualizadoEn, bool existe)",
  "function verificarIntegridad(bytes32 loteId, bytes32 hashAVerificar) external view returns (bool)",
  "event LoteRegistrado(bytes32 indexed loteId, address indexed agricultor, bytes32 dataHash, uint256 timestamp)",
  "event EventoRegistrado(bytes32 indexed loteId, string tipoEvento, bytes32 evidenciaHash, address registradoPor, uint256 timestamp)",
];

const CERTIFICADO_NFT_ABI = [
  "function emitirCertificado(bytes32 loteId, address agricultor, string calldata numeroCertificado, uint8 tipo, uint256 diasVigencia, string calldata ipfsUri) external returns (uint256 tokenId)",
  "function revocarCertificado(uint256 tokenId, bytes32 motivoHash) external",
  "function esCertificadoValido(uint256 tokenId) external view returns (bool)",
  "event CertificadoEmitido(uint256 indexed tokenId, bytes32 indexed loteId, address indexed agricultor, string numeroCertificado, uint8 tipo, uint256 fechaVencimiento)",
];

// TipoCertificado enum igual que en el contrato (orden importa)
const TIPO_CERTIFICADO_ENUM: Record<string, number> = {
  BPA_ICA:           0,
  ORGANICO:          1,
  GLOBAL_GAP:        2,
  RAINFOREST:        3,
  INVIMA_INOCUIDAD:  4,
};

// ── Helpers de conversión ─────────────────────────────────────────────────────

/** Convierte un string hexadecimal "0x..." o hash hex sin prefijo a bytes32 */
function toBytes32(hex: string): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return "0x" + clean.padStart(64, "0").slice(0, 64);
}

/** Convierte ID de DB (ej. "lote_001") en bytes32 determinista */
function idToBytes32(id: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(id));
}

// ── Estado del servicio ───────────────────────────────────────────────────────

let _provider: ethers.JsonRpcProvider | null = null;
let _signer: ethers.Wallet | null = null;
let _loteRegistry: ethers.Contract | null = null;
let _certificadoNFT: ethers.Contract | null = null;

function isConfigured(): boolean {
  return !!(
    process.env.BACKEND_WALLET_PRIVATE_KEY &&
    process.env.CONTRACT_LOTE_REGISTRY &&
    process.env.CONTRACT_CERTIFICADO_NFT
  );
}

function getContracts(): { loteRegistry: ethers.Contract; certificadoNFT: ethers.Contract; signer: ethers.Wallet } {
  if (!isConfigured()) {
    throw new Error("Blockchain no configurado — revisa BACKEND_WALLET_PRIVATE_KEY y CONTRACT_* en .env");
  }

  if (!_loteRegistry || !_certificadoNFT || !_signer) {
    const rpc = process.env.POLYGON_RPC_URL ?? "https://rpc-amoy.polygon.technology";
    _provider  = new ethers.JsonRpcProvider(rpc);
    _signer    = new ethers.Wallet(process.env.BACKEND_WALLET_PRIVATE_KEY!, _provider);
    _loteRegistry  = new ethers.Contract(process.env.CONTRACT_LOTE_REGISTRY!,  LOTE_REGISTRY_ABI,  _signer);
    _certificadoNFT = new ethers.Contract(process.env.CONTRACT_CERTIFICADO_NFT!, CERTIFICADO_NFT_ABI, _signer);
  }

  return { loteRegistry: _loteRegistry!, certificadoNFT: _certificadoNFT!, signer: _signer! };
}

// ── Resultado estándar ────────────────────────────────────────────────────────

export interface TxResult {
  txHash: string;
  blockNumber: number;
  gasUsed: string;
}

// ── Operaciones públicas ──────────────────────────────────────────────────────

/**
 * Registra un lote en LoteRegistry.
 * @param loteId  ID interno del lote (ej. "lote_001")
 * @param dataHash SHA256 hex del lote (sin 0x)
 * @returns txHash y número de bloque
 */
export async function registrarLoteOnChain(loteId: string, dataHash: string): Promise<TxResult> {
  const { loteRegistry } = getContracts();

  const loteIdBytes  = idToBytes32(loteId);
  const dataHashBytes = toBytes32(dataHash);

  const tx: ethers.TransactionResponse = await loteRegistry.registrarLote(loteIdBytes, dataHashBytes);
  const receipt = await tx.wait(1);

  if (!receipt || receipt.status !== 1) {
    throw new Error(`TX revertida: ${tx.hash}`);
  }

  return {
    txHash:      receipt.hash,
    blockNumber: receipt.blockNumber,
    gasUsed:     receipt.gasUsed.toString(),
  };
}

/**
 * Registra un evento de producción on-chain.
 * @param loteId      ID interno del lote
 * @param tipoEvento  Tipo de evento (ej. "COSECHA")
 * @param contentHash SHA256 del evento (hex, sin 0x)
 */
export async function registrarEventoOnChain(
  loteId:      string,
  tipoEvento:  string,
  contentHash: string,
): Promise<TxResult> {
  const { loteRegistry } = getContracts();

  const loteIdBytes     = idToBytes32(loteId);
  const evidenciaBytes  = toBytes32(contentHash);

  const tx: ethers.TransactionResponse = await loteRegistry.registrarEvento(loteIdBytes, tipoEvento, evidenciaBytes);
  const receipt = await tx.wait(1);

  if (!receipt || receipt.status !== 1) {
    throw new Error(`TX revertida: ${tx.hash}`);
  }

  return {
    txHash:      receipt.hash,
    blockNumber: receipt.blockNumber,
    gasUsed:     receipt.gasUsed.toString(),
  };
}

/**
 * Mintea el NFT del certificado en CertificadoNFT.
 * @returns tokenId del NFT emitido + txHash
 */
export async function emitirCertificadoOnChain(params: {
  loteId:            string;
  agricultorAddress: string;
  numeroCertificado: string;
  tipo:              string;   // "BPA_ICA" | "ORGANICO" | ...
  diasVigencia:      number;
  ipfsUri:           string;
}): Promise<TxResult & { tokenId: number }> {
  const { certificadoNFT } = getContracts();

  const loteIdBytes = idToBytes32(params.loteId);
  const tipoEnum    = TIPO_CERTIFICADO_ENUM[params.tipo];
  if (tipoEnum === undefined) throw new Error(`Tipo de certificado desconocido: ${params.tipo}`);

  // agricultorAddress debe ser una dirección Ethereum válida
  // Si el agricultor no tiene wallet, usamos la del backend como proxy
  const agricultorAddr = ethers.isAddress(params.agricultorAddress)
    ? params.agricultorAddress
    : (await getContracts().signer.getAddress());

  const tx: ethers.TransactionResponse = await certificadoNFT.emitirCertificado(
    loteIdBytes,
    agricultorAddr,
    params.numeroCertificado,
    tipoEnum,
    params.diasVigencia,
    params.ipfsUri,
  );
  const receipt = await tx.wait(1);

  if (!receipt || receipt.status !== 1) {
    throw new Error(`TX revertida: ${tx.hash}`);
  }

  // Extraer tokenId del evento CertificadoEmitido
  const iface    = new ethers.Interface(CERTIFICADO_NFT_ABI);
  let tokenId    = 0;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name === "CertificadoEmitido") {
        tokenId = Number(parsed.args.tokenId);
        break;
      }
    } catch { /* log de otro contrato */ }
  }

  return {
    txHash:      receipt.hash,
    blockNumber: receipt.blockNumber,
    gasUsed:     receipt.gasUsed.toString(),
    tokenId,
  };
}

/**
 * Revoca un certificado NFT on-chain.
 */
export async function revocarCertificadoOnChain(tokenId: number, motivo: string): Promise<TxResult> {
  const { certificadoNFT } = getContracts();

  const motivoHash = ethers.keccak256(ethers.toUtf8Bytes(motivo));
  const tx: ethers.TransactionResponse = await certificadoNFT.revocarCertificado(tokenId, motivoHash);
  const receipt = await tx.wait(1);

  if (!receipt || receipt.status !== 1) {
    throw new Error(`TX revertida: ${tx.hash}`);
  }

  return {
    txHash:      receipt.hash,
    blockNumber: receipt.blockNumber,
    gasUsed:     receipt.gasUsed.toString(),
  };
}

/** Verifica si el blockchain está configurado y responde */
export async function verificarConexion(): Promise<{ ok: boolean; red?: string; saldo?: string; error?: string }> {
  if (!isConfigured()) {
    return { ok: false, error: "Variables de entorno BACKEND_WALLET_PRIVATE_KEY y CONTRACT_* no configuradas" };
  }
  try {
    const { signer } = getContracts();
    const [network, balance] = await Promise.all([
      signer.provider!.getNetwork(),
      signer.provider!.getBalance(signer.address),
    ]);
    return {
      ok:    true,
      red:   `${network.name} (chainId ${network.chainId})`,
      saldo: `${ethers.formatEther(balance)} MATIC`,
    };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Ejecuta el flujo completo de inspección on-chain:
 *   solicitarInspeccion → iniciarInspeccion → finalizarInspeccion
 * El backend actúa como agricultor e inspector (roles asignados en setup-roles).
 *
 * @param loteId      ID interno del lote
 * @param aprobado    true = COSECHADO, false = RECHAZADO
 * @param reporteHash hex sin 0x del hash del reporte
 */
export async function finalizarInspeccionOnChain(
  loteId:      string,
  aprobado:    boolean,
  reporteHash: string,
): Promise<TxResult> {
  const { loteRegistry } = getContracts();
  const loteIdBytes  = idToBytes32(loteId);
  const reporteBytes = toBytes32(reporteHash);

  // Verificar estado actual del lote on-chain
  // Enum: 0=REGISTRADO,1=EN_PRODUCCION,2=COSECHADO,3=INSPECCION_SOLICITADA,4=EN_INSPECCION,5=CERTIFICADO,6=RECHAZADO,7=REVOCADO
  const loteData     = await loteRegistry.lotes(loteIdBytes);
  const estadoActual = Number(loteData[3]);

  // Estados finales: no se puede anclar
  // 5=CERTIFICADO, 6=RECHAZADO, 7=REVOCADO
  if (estadoActual >= 5) {
    throw new Error(`Estado on-chain inválido para inspección: ${estadoActual}. El lote ya fue inspeccionado o certificado en Polygon.`);
  }

  // REGISTRADO(0) o EN_PRODUCCION(1) o COSECHADO(2) → solicitar inspección
  if (estadoActual <= 2) {
    const tx1 = await loteRegistry.solicitarInspeccion(loteIdBytes);
    await tx1.wait(1);
  }

  // INSPECCION_SOLICITADA(3) → iniciar inspección
  if (estadoActual <= 3) {
    const tx2 = await loteRegistry.iniciarInspeccion(loteIdBytes);
    await tx2.wait(1);
  }

  // EN_INSPECCION(4) → registrar resultado
  const tx: ethers.TransactionResponse = await loteRegistry.registrarResultadoInspeccion(
    loteIdBytes, aprobado, reporteBytes,
  );
  const receipt = await tx.wait(1);

  if (!receipt || receipt.status !== 1) {
    throw new Error(`TX revertida: ${tx.hash}`);
  }

  return {
    txHash:      receipt.hash,
    blockNumber: receipt.blockNumber,
    gasUsed:     receipt.gasUsed.toString(),
  };
}

export { idToBytes32, toBytes32, isConfigured };
