import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("   AGROCHAIN — Deploy de contratos en Polygon");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`   Red:       ${network.name} (chainId: ${network.config.chainId})`);
  console.log(`   Deployer:  ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`   Balance:   ${ethers.formatEther(balance)} MATIC\n`);

  // ── 1. RoleManager ──────────────────────────────────────────────────────
  console.log("1/3 Desplegando RoleManager...");
  const RoleManager = await ethers.getContractFactory("RoleManager");
  const roleManager = await RoleManager.deploy(deployer.address);
  await roleManager.waitForDeployment();
  const roleManagerAddr = await roleManager.getAddress();
  console.log(`   ✅ RoleManager: ${roleManagerAddr}`);

  // ── 2. LoteRegistry ─────────────────────────────────────────────────────
  console.log("2/3 Desplegando LoteRegistry...");
  const LoteRegistry = await ethers.getContractFactory("LoteRegistry");
  const loteRegistry = await LoteRegistry.deploy(roleManagerAddr);
  await loteRegistry.waitForDeployment();
  const loteRegistryAddr = await loteRegistry.getAddress();
  console.log(`   ✅ LoteRegistry: ${loteRegistryAddr}`);

  // ── 3. CertificadoNFT ───────────────────────────────────────────────────
  console.log("3/3 Desplegando CertificadoNFT...");
  const CertificadoNFT = await ethers.getContractFactory("CertificadoNFT");
  const certificadoNFT = await CertificadoNFT.deploy(
    roleManagerAddr,
    loteRegistryAddr,
    deployer.address
  );
  await certificadoNFT.waitForDeployment();
  const certificadoNFTAddr = await certificadoNFT.getAddress();
  console.log(`   ✅ CertificadoNFT: ${certificadoNFTAddr}`);

  // ── VINCULAR CONTRATOS ───────────────────────────────────────────────────
  console.log("\nVinculando CertificadoNFT → LoteRegistry...");
  await (await loteRegistry.setCertificadoNFT(certificadoNFTAddr)).wait();
  console.log("   ✅ Vinculacion completada");

  // ── GUARDAR DIRECCIONES ──────────────────────────────────────────────────
  const deployInfo = {
    red: network.name,
    chainId: network.config.chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contratos: {
      RoleManager:    roleManagerAddr,
      LoteRegistry:   loteRegistryAddr,
      CertificadoNFT: certificadoNFTAddr,
    },
  };

  const outputDir  = path.join(__dirname, "../deployments");
  const outputFile = path.join(outputDir, `${network.name}.json`);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(deployInfo, null, 2));

  // Actualizar .env del API automaticamente
  const envApiPath = path.join(__dirname, "../../../apps/api/.env");
  if (fs.existsSync(envApiPath)) {
    let envContent = fs.readFileSync(envApiPath, "utf8");
    envContent = envContent
      .replace(/CONTRACT_LOTE_REGISTRY=.*/,   `CONTRACT_LOTE_REGISTRY=${loteRegistryAddr}`)
      .replace(/CONTRACT_CERTIFICADO_NFT=.*/, `CONTRACT_CERTIFICADO_NFT=${certificadoNFTAddr}`)
      .replace(/CONTRACT_ROLE_MANAGER=.*/,    `CONTRACT_ROLE_MANAGER=${roleManagerAddr}`);
    fs.writeFileSync(envApiPath, envContent);
    console.log("\n   📝 .env del API actualizado con las direcciones");
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("   DEPLOY COMPLETADO");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`   Archivo: deployments/${network.name}.json`);

  if (network.name !== "localhost" && network.name !== "hardhat") {
    console.log("\n   Verifica en PolygonScan:");
    const explorer = network.name === "amoy"
      ? "https://amoy.polygonscan.com"
      : "https://polygonscan.com";
    console.log(`   ${explorer}/address/${roleManagerAddr}`);
    console.log(`   ${explorer}/address/${loteRegistryAddr}`);
    console.log(`   ${explorer}/address/${certificadoNFTAddr}`);
  }

  console.log("");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
