/**
 * Consulta el estado on-chain de lote_001 y lote_002 en Polygon Amoy.
 * Uso: cd packages/contracts && ../../node_modules/.bin/hardhat run scripts/check-lote-state.ts --network amoy
 */
import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const LOTE_REGISTRY_ABI = [
  "function lotes(bytes32) external view returns (bytes32 dataHash, address agricultor, address certificadora, uint8 estado, uint256 creadoEn, uint256 actualizadoEn, bool existe)",
  "function totalEventos(bytes32 loteId) external view returns (uint256)",
];

const ESTADO_NAMES = [
  "REGISTRADO",
  "EN_PRODUCCION",
  "COSECHADO",
  "INSPECCION_SOLICITADA",
  "EN_INSPECCION",
  "CERTIFICADO",
  "RECHAZADO",
  "REVOCADO",
];

function idToBytes32(id: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(id));
}

async function main() {
  const [signer] = await ethers.getSigners();
  const deployFile = path.join(__dirname, `../deployments/${network.name}.json`);
  const deployment = JSON.parse(fs.readFileSync(deployFile, "utf8"));
  const loteRegistry = new ethers.Contract(deployment.contratos.LoteRegistry, LOTE_REGISTRY_ABI, signer);

  console.log(`\nRed: ${network.name} | LoteRegistry: ${deployment.contratos.LoteRegistry}\n`);

  for (const loteId of ["lote_001", "lote_002"]) {
    const bytes32 = idToBytes32(loteId);
    const data = await loteRegistry.lotes(bytes32);
    const existe = data[6];
    if (!existe) {
      console.log(`${loteId}: NO REGISTRADO en Polygon`);
      continue;
    }
    const estado = Number(data[3]);
    const totalEv = await loteRegistry.totalEventos(bytes32);
    console.log(`${loteId}:`);
    console.log(`  Estado:    ${estado} = ${ESTADO_NAMES[estado] ?? "DESCONOCIDO"}`);
    console.log(`  Agricultor: ${data[1]}`);
    console.log(`  Eventos:   ${totalEv}`);
    console.log(`  DataHash:  ${data[0]}`);
    console.log();
  }
}

main().catch(console.error);
