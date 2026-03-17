/**
 * Deploy parcial: solo CertificadoNFT + vinculación.
 * Usar cuando RoleManager y LoteRegistry ya están desplegados.
 */
import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const ROLE_MANAGER_ADDR  = "0x84565cf3d3A9Ed7589d4D972B45247C17f586bd0";
const LOTE_REGISTRY_ADDR = "0x6f4C1D2c02f39bB8B50E848CdA743F8300bcc5dc";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("   AGROCHAIN — Deploy CertificadoNFT (parcial)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`   Deployer:  ${deployer.address}`);
  console.log(`   Balance:   ${ethers.formatEther(balance)} MATIC`);
  console.log(`   RoleManager:  ${ROLE_MANAGER_ADDR}`);
  console.log(`   LoteRegistry: ${LOTE_REGISTRY_ADDR}\n`);

  console.log("Desplegando CertificadoNFT...");
  const CertificadoNFT = await ethers.getContractFactory("CertificadoNFT");
  const certificadoNFT = await CertificadoNFT.deploy(
    ROLE_MANAGER_ADDR,
    LOTE_REGISTRY_ADDR,
    deployer.address
  );
  await certificadoNFT.waitForDeployment();
  const certificadoNFTAddr = await certificadoNFT.getAddress();
  console.log(`   ✅ CertificadoNFT: ${certificadoNFTAddr}`);

  console.log("\nVinculando CertificadoNFT → LoteRegistry...");
  const loteRegistry = await ethers.getContractAt("LoteRegistry", LOTE_REGISTRY_ADDR);
  await (await loteRegistry.setCertificadoNFT(certificadoNFTAddr)).wait();
  console.log("   ✅ Vinculación completada");

  // Guardar deployment
  const deployInfo = {
    red: network.name,
    chainId: network.config.chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contratos: {
      RoleManager:    ROLE_MANAGER_ADDR,
      LoteRegistry:   LOTE_REGISTRY_ADDR,
      CertificadoNFT: certificadoNFTAddr,
    },
  };

  const outputDir  = path.join(__dirname, "../deployments");
  const outputFile = path.join(outputDir, `${network.name}.json`);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(deployInfo, null, 2));

  // Actualizar .env del API
  const envApiPath = path.join(__dirname, "../../../apps/api/.env");
  if (fs.existsSync(envApiPath)) {
    let envContent = fs.readFileSync(envApiPath, "utf8");
    envContent = envContent
      .replace(/CONTRACT_LOTE_REGISTRY=.*/,   `CONTRACT_LOTE_REGISTRY=${LOTE_REGISTRY_ADDR}`)
      .replace(/CONTRACT_CERTIFICADO_NFT=.*/, `CONTRACT_CERTIFICADO_NFT=${certificadoNFTAddr}`)
      .replace(/CONTRACT_ROLE_MANAGER=.*/,    `CONTRACT_ROLE_MANAGER=${ROLE_MANAGER_ADDR}`)
      .replace(/BACKEND_WALLET_PRIVATE_KEY=.*/, `BACKEND_WALLET_PRIVATE_KEY=${process.env.DEPLOYER_PRIVATE_KEY ?? ""}`);
    fs.writeFileSync(envApiPath, envContent);
    console.log("\n   📝 .env del API actualizado");
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("   DEPLOY COMPLETADO");
  console.log(`   https://amoy.polygonscan.com/address/${certificadoNFTAddr}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
