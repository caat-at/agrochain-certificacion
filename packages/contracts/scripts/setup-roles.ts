/**
 * Script de configuración de roles post-deploy.
 * Asigna AGRICULTOR_ROLE, CERTIFICADORA_ROLE, INSPECTOR_BPA_ROLE e INSPECTOR_ICA_ROLE
 * a la wallet del backend (deployer) para operar todos los flujos del sistema.
 *
 * Uso:
 *   cd packages/contracts
 *   ../../node_modules/.bin/hardhat run scripts/setup-roles.ts --network amoy
 */
import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function asignarSiFalta(
  roleManager: any,
  wallet: string,
  role: string,
  roleBytes: string,
  verificar: (addr: string) => Promise<boolean>,
) {
  const ya = await verificar(wallet);
  if (ya) {
    console.log(`   ✅ ${wallet} ya tiene ${role}.`);
    return;
  }
  console.log(`   Asignando ${role} a ${wallet}...`);
  const tx = await roleManager.asignarRol(wallet, roleBytes);
  await tx.wait(1);
  const ok = await verificar(wallet);
  if (!ok) throw new Error(`Error: ${role} no fue asignado.`);
  console.log(`   ✅ ${role} asignado. TxHash: ${tx.hash}`);
}

async function main() {
  const [deployer] = await ethers.getSigners();

  const deployFile = path.join(__dirname, `../deployments/${network.name}.json`);
  if (!fs.existsSync(deployFile)) {
    throw new Error(`No hay deployment para la red "${network.name}". Ejecuta deploy.ts primero.`);
  }
  const deployment = JSON.parse(fs.readFileSync(deployFile, "utf8"));
  const roleManagerAddr = deployment.contratos.RoleManager;

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("   AGROCHAIN — Setup de roles post-deploy");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`   Red:         ${network.name} (chainId: ${network.config.chainId})`);
  console.log(`   Admin:       ${deployer.address}`);
  console.log(`   RoleManager: ${roleManagerAddr}\n`);

  const roleManager = await ethers.getContractAt("RoleManager", roleManagerAddr, deployer);
  const backendWallet = deployer.address;

  await asignarSiFalta(
    roleManager, backendWallet,
    "AGRICULTOR_ROLE",
    ethers.keccak256(ethers.toUtf8Bytes("AGRICULTOR")),
    (addr) => roleManager.esAgricultor(addr),
  );

  await asignarSiFalta(
    roleManager, backendWallet,
    "CERTIFICADORA_ROLE",
    ethers.keccak256(ethers.toUtf8Bytes("CERTIFICADORA")),
    (addr) => roleManager.esCertificadora(addr),
  );

  await asignarSiFalta(
    roleManager, backendWallet,
    "INSPECTOR_BPA_ROLE",
    ethers.keccak256(ethers.toUtf8Bytes("INSPECTOR_BPA")),
    (addr) => roleManager.esInspectorBpa(addr),
  );

  await asignarSiFalta(
    roleManager, backendWallet,
    "INSPECTOR_ICA_ROLE",
    ethers.keccak256(ethers.toUtf8Bytes("INSPECTOR_ICA")),
    (addr) => roleManager.esInspectorIca(addr),
  );

  console.log("\n   Roles configurados:");
  console.log("   - AGRICULTOR_ROLE    → registrarLote(), registrarEvento()");
  console.log("   - CERTIFICADORA_ROLE → emitirCertificado() en CertificadoNFT");
  console.log("   - INSPECTOR_BPA_ROLE → iniciarInspeccion(), finalizarInspeccion()");
  console.log("   - INSPECTOR_ICA_ROLE → iniciarInspeccion(), finalizarInspeccion()");
  console.log("");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
