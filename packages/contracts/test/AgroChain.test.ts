import { expect } from "chai";
import { ethers } from "hardhat";
import { RoleManager, LoteRegistry, CertificadoNFT } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("AgroChain — Suite de pruebas", () => {
  // Contratos
  let roleManager:   RoleManager;
  let loteRegistry:  LoteRegistry;
  let certificadoNFT: CertificadoNFT;

  // Cuentas
  let admin:         HardhatEthersSigner;
  let agricultor:    HardhatEthersSigner;
  let inspector:     HardhatEthersSigner;
  let certificadora: HardhatEthersSigner;
  let consumidor:    HardhatEthersSigner;

  // Datos de prueba
  const LOTE_ID     = ethers.keccak256(ethers.toUtf8Bytes("COL-05-2024-00001"));
  const DATA_HASH   = ethers.keccak256(ethers.toUtf8Bytes("datos-del-lote-json"));
  const EVID_HASH   = ethers.keccak256(ethers.toUtf8Bytes("ipfs-cid-foto"));
  const REPORT_HASH = ethers.keccak256(ethers.toUtf8Bytes("ipfs-cid-reporte-pdf"));
  const IPFS_URI    = "ipfs://QmCertificadoAgroChain001";
  const NRO_CERT    = "BPA-ANT-2024-00001";

  // ── DEPLOY ANTES DE CADA TEST ─────────────────────────────────────────────
  beforeEach(async () => {
    [admin, agricultor, inspector, certificadora, consumidor] =
      await ethers.getSigners();

    // Deploy RoleManager
    const RoleManagerF = await ethers.getContractFactory("RoleManager");
    roleManager = await RoleManagerF.deploy(admin.address);

    // Deploy LoteRegistry
    const LoteRegistryF = await ethers.getContractFactory("LoteRegistry");
    loteRegistry = await LoteRegistryF.deploy(await roleManager.getAddress());

    // Deploy CertificadoNFT
    const CertificadoNFTF = await ethers.getContractFactory("CertificadoNFT");
    certificadoNFT = await CertificadoNFTF.deploy(
      await roleManager.getAddress(),
      await loteRegistry.getAddress(),
      admin.address
    );

    // Asignar roles
    await roleManager.connect(admin).asignarRol(agricultor.address,    roleManager.AGRICULTOR_ROLE());
    await roleManager.connect(admin).asignarRol(inspector.address,     roleManager.INSPECTOR_BPA_ROLE());
    await roleManager.connect(admin).asignarRol(certificadora.address, roleManager.CERTIFICADORA_ROLE());

    // Vincular CertificadoNFT → LoteRegistry
    await loteRegistry.setCertificadoNFT(await certificadoNFT.getAddress());
  });

  // ════════════════════════════════════════════════════════════════════════════
  describe("RoleManager", () => {
    it("Asigna roles correctamente", async () => {
      expect(await roleManager.esAgricultor(agricultor.address)).to.be.true;
      expect(await roleManager.esInspectorBpa(inspector.address)).to.be.true;
      expect(await roleManager.esCertificadora(certificadora.address)).to.be.true;
    });

    it("Consumidor sin rol no tiene permisos", async () => {
      expect(await roleManager.esAgricultor(consumidor.address)).to.be.false;
      expect(await roleManager.esCertificadora(consumidor.address)).to.be.false;
    });

    it("Solo admin puede asignar roles", async () => {
      await expect(
        roleManager.connect(agricultor).asignarRol(
          consumidor.address,
          roleManager.AGRICULTOR_ROLE()
        )
      ).to.be.reverted;
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  describe("LoteRegistry — Registro de lote", () => {
    it("Agricultor registra lote exitosamente", async () => {
      await expect(
        loteRegistry.connect(agricultor).registrarLote(LOTE_ID, DATA_HASH)
      )
        .to.emit(loteRegistry, "LoteRegistrado")
        .withArgs(LOTE_ID, agricultor.address, DATA_HASH, await getTimestamp());

      const lote = await loteRegistry.lotes(LOTE_ID);
      expect(lote.existe).to.be.true;
      expect(lote.agricultor).to.equal(agricultor.address);
      expect(lote.dataHash).to.equal(DATA_HASH);
      expect(lote.estado).to.equal(0); // REGISTRADO
    });

    it("No permite registrar lote duplicado", async () => {
      await loteRegistry.connect(agricultor).registrarLote(LOTE_ID, DATA_HASH);
      await expect(
        loteRegistry.connect(agricultor).registrarLote(LOTE_ID, DATA_HASH)
      ).to.be.revertedWith("AgroChain: Lote ya registrado");
    });

    it("Sin rol AGRICULTOR no puede registrar lote", async () => {
      await expect(
        loteRegistry.connect(consumidor).registrarLote(LOTE_ID, DATA_HASH)
      ).to.be.revertedWith("AgroChain: Solo agricultores pueden ejecutar esta accion");
    });

    it("dataHash cero es rechazado", async () => {
      await expect(
        loteRegistry.connect(agricultor).registrarLote(LOTE_ID, ethers.ZeroHash)
      ).to.be.revertedWith("AgroChain: dataHash no puede ser cero");
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  describe("LoteRegistry — Verificacion de integridad", () => {
    beforeEach(async () => {
      await loteRegistry.connect(agricultor).registrarLote(LOTE_ID, DATA_HASH);
    });

    it("Hash correcto retorna true", async () => {
      expect(
        await loteRegistry.verificarIntegridad(LOTE_ID, DATA_HASH)
      ).to.be.true;
    });

    it("Hash incorrecto retorna false", async () => {
      const hashFalso = ethers.keccak256(ethers.toUtf8Bytes("datos-alterados"));
      expect(
        await loteRegistry.verificarIntegridad(LOTE_ID, hashFalso)
      ).to.be.false;
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  describe("LoteRegistry — Eventos de produccion (NTC 5400)", () => {
    beforeEach(async () => {
      await loteRegistry.connect(agricultor).registrarLote(LOTE_ID, DATA_HASH);
    });

    it("Registra evento de siembra", async () => {
      await expect(
        loteRegistry.connect(agricultor).registrarEvento(LOTE_ID, "SIEMBRA", EVID_HASH)
      )
        .to.emit(loteRegistry, "EventoRegistrado")
        .withArgs(LOTE_ID, "SIEMBRA", EVID_HASH, agricultor.address, await getTimestamp());

      expect(await loteRegistry.totalEventos(LOTE_ID)).to.equal(1);
    });

    it("Primer evento avanza estado a EN_PRODUCCION", async () => {
      await loteRegistry.connect(agricultor).registrarEvento(LOTE_ID, "SIEMBRA", EVID_HASH);
      const lote = await loteRegistry.lotes(LOTE_ID);
      expect(lote.estado).to.equal(1); // EN_PRODUCCION
    });

    it("Inspector puede registrar evento", async () => {
      await loteRegistry.connect(inspector).registrarEvento(LOTE_ID, "INSPECCION_CAMPO", EVID_HASH);
      expect(await loteRegistry.totalEventos(LOTE_ID)).to.equal(1);
    });

    it("Consumidor sin rol no puede registrar evento", async () => {
      await expect(
        loteRegistry.connect(consumidor).registrarEvento(LOTE_ID, "RIEGO", EVID_HASH)
      ).to.be.revertedWith("AgroChain: Sin permiso para registrar eventos");
    });

    it("evidenciaHash cero es rechazado", async () => {
      await expect(
        loteRegistry.connect(agricultor).registrarEvento(LOTE_ID, "RIEGO", ethers.ZeroHash)
      ).to.be.revertedWith("AgroChain: evidenciaHash requerido");
    });

    it("Recupera evento por indice", async () => {
      await loteRegistry.connect(agricultor).registrarEvento(LOTE_ID, "FERTILIZACION", EVID_HASH);
      const evento = await loteRegistry.getEvento(LOTE_ID, 0);
      expect(evento.tipoEvento).to.equal("FERTILIZACION");
      expect(evento.evidenciaHash).to.equal(EVID_HASH);
      expect(evento.registradoPor).to.equal(agricultor.address);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  describe("LoteRegistry — Flujo de inspeccion", () => {
    beforeEach(async () => {
      await loteRegistry.connect(agricultor).registrarLote(LOTE_ID, DATA_HASH);
      await loteRegistry.connect(agricultor).registrarEvento(LOTE_ID, "COSECHA", EVID_HASH);
      // Estado ahora: EN_PRODUCCION
    });

    it("Agricultor solicita inspeccion", async () => {
      await loteRegistry.connect(agricultor).solicitarInspeccion(LOTE_ID);
      const lote = await loteRegistry.lotes(LOTE_ID);
      expect(lote.estado).to.equal(3); // INSPECCION_SOLICITADA
    });

    it("Inspector inicia y aprueba inspeccion", async () => {
      await loteRegistry.connect(agricultor).solicitarInspeccion(LOTE_ID);
      await loteRegistry.connect(inspector).iniciarInspeccion(LOTE_ID);
      await loteRegistry.connect(inspector).registrarResultadoInspeccion(LOTE_ID, true, REPORT_HASH);

      const lote = await loteRegistry.lotes(LOTE_ID);
      expect(lote.estado).to.equal(2); // COSECHADO (listo para certificar)
    });

    it("Inspector rechaza inspeccion", async () => {
      await loteRegistry.connect(agricultor).solicitarInspeccion(LOTE_ID);
      await loteRegistry.connect(inspector).iniciarInspeccion(LOTE_ID);
      await loteRegistry.connect(inspector).registrarResultadoInspeccion(LOTE_ID, false, REPORT_HASH);

      const lote = await loteRegistry.lotes(LOTE_ID);
      expect(lote.estado).to.equal(6); // RECHAZADO
    });

    it("Solo el dueno puede solicitar inspeccion", async () => {
      await expect(
        loteRegistry.connect(inspector).solicitarInspeccion(LOTE_ID)
      ).to.be.revertedWith("AgroChain: Solo agricultores pueden ejecutar esta accion");
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  describe("CertificadoNFT — Emision ERC-721", () => {
    beforeEach(async () => {
      // Flujo completo hasta COSECHADO
      await loteRegistry.connect(agricultor).registrarLote(LOTE_ID, DATA_HASH);
      await loteRegistry.connect(agricultor).registrarEvento(LOTE_ID, "COSECHA", EVID_HASH);
      await loteRegistry.connect(agricultor).solicitarInspeccion(LOTE_ID);
      await loteRegistry.connect(inspector).iniciarInspeccion(LOTE_ID);
      await loteRegistry.connect(inspector).registrarResultadoInspeccion(LOTE_ID, true, REPORT_HASH);
      // Estado: COSECHADO — listo para NFT
    });

    it("Certificadora emite NFT correctamente", async () => {
      await certificadoNFT.connect(certificadora).emitirCertificado(
        LOTE_ID,
        agricultor.address,
        NRO_CERT,
        0, // BPA_ICA
        365,
        IPFS_URI
      );
      // Verificamos el evento por partes — el timestamp exacto de fechaVencimiento
      // depende del bloque minado, por lo que solo verificamos los campos fijos
      const filter = certificadoNFT.filters.CertificadoEmitido(1n, LOTE_ID);
      const events = await certificadoNFT.queryFilter(filter);
      expect(events.length).to.equal(1);
      expect(events[0].args.tokenId).to.equal(1n);
      expect(events[0].args.loteId).to.equal(LOTE_ID);
      expect(events[0].args.agricultor).to.equal(agricultor.address);
      expect(events[0].args.numeroCertificado).to.equal(NRO_CERT);
      expect(events[0].args.tipo).to.equal(0n); // BPA_ICA

      // Agricultor recibe el NFT
      expect(await certificadoNFT.ownerOf(1)).to.equal(agricultor.address);
      expect(await certificadoNFT.tokenURI(1)).to.equal(IPFS_URI);

      // Metadata correcta
      const cert = await certificadoNFT.certificados(1);
      expect(cert.loteId).to.equal(LOTE_ID);
      expect(cert.numeroCertificado).to.equal(NRO_CERT);
      expect(cert.revocado).to.be.false;
    });

    it("Lote queda en estado CERTIFICADO en LoteRegistry", async () => {
      await certificadoNFT.connect(certificadora).emitirCertificado(
        LOTE_ID, agricultor.address, NRO_CERT, 0, 365, IPFS_URI
      );
      const lote = await loteRegistry.lotes(LOTE_ID);
      expect(lote.estado).to.equal(5); // CERTIFICADO
    });

    it("Certificado valido retorna true", async () => {
      await certificadoNFT.connect(certificadora).emitirCertificado(
        LOTE_ID, agricultor.address, NRO_CERT, 0, 365, IPFS_URI
      );
      expect(await certificadoNFT.esCertificadoValido(1)).to.be.true;
    });

    it("No permite doble certificacion del mismo lote", async () => {
      await certificadoNFT.connect(certificadora).emitirCertificado(
        LOTE_ID, agricultor.address, NRO_CERT, 0, 365, IPFS_URI
      );
      await expect(
        certificadoNFT.connect(certificadora).emitirCertificado(
          LOTE_ID, agricultor.address, "BPA-ANT-2024-00002", 0, 365, IPFS_URI
        )
      ).to.be.revertedWith("AgroChain: Lote ya tiene certificado activo");
    });

    it("No permite numero de certificado duplicado", async () => {
      await certificadoNFT.connect(certificadora).emitirCertificado(
        LOTE_ID, agricultor.address, NRO_CERT, 0, 365, IPFS_URI
      );
      // Crear segundo lote
      const LOTE2 = ethers.keccak256(ethers.toUtf8Bytes("COL-05-2024-00002"));
      await loteRegistry.connect(agricultor).registrarLote(LOTE2, DATA_HASH);
      await loteRegistry.connect(agricultor).registrarEvento(LOTE2, "COSECHA", EVID_HASH);
      await loteRegistry.connect(agricultor).solicitarInspeccion(LOTE2);
      await loteRegistry.connect(inspector).iniciarInspeccion(LOTE2);
      await loteRegistry.connect(inspector).registrarResultadoInspeccion(LOTE2, true, REPORT_HASH);

      await expect(
        certificadoNFT.connect(certificadora).emitirCertificado(
          LOTE2, agricultor.address, NRO_CERT, 0, 365, IPFS_URI
        )
      ).to.be.revertedWith("AgroChain: Numero de certificado ya existe");
    });

    it("Sin rol CERTIFICADORA no puede emitir NFT", async () => {
      await expect(
        certificadoNFT.connect(consumidor).emitirCertificado(
          LOTE_ID, agricultor.address, NRO_CERT, 0, 365, IPFS_URI
        )
      ).to.be.revertedWith("AgroChain: Solo certificadoras pueden emitir certificados");
    });

    it("Agricultore puede transferir el NFT (certificado es del producto)", async () => {
      await certificadoNFT.connect(certificadora).emitirCertificado(
        LOTE_ID, agricultor.address, NRO_CERT, 0, 365, IPFS_URI
      );
      await certificadoNFT.connect(agricultor).transferFrom(
        agricultor.address,
        consumidor.address,
        1
      );
      expect(await certificadoNFT.ownerOf(1)).to.equal(consumidor.address);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  describe("CertificadoNFT — Revocacion", () => {
    beforeEach(async () => {
      await loteRegistry.connect(agricultor).registrarLote(LOTE_ID, DATA_HASH);
      await loteRegistry.connect(agricultor).registrarEvento(LOTE_ID, "COSECHA", EVID_HASH);
      await loteRegistry.connect(agricultor).solicitarInspeccion(LOTE_ID);
      await loteRegistry.connect(inspector).iniciarInspeccion(LOTE_ID);
      await loteRegistry.connect(inspector).registrarResultadoInspeccion(LOTE_ID, true, REPORT_HASH);
      await certificadoNFT.connect(certificadora).emitirCertificado(
        LOTE_ID, agricultor.address, NRO_CERT, 0, 365, IPFS_URI
      );
    });

    it("Certificadora revoca certificado", async () => {
      const motivoHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs-motivo-revocacion"));
      await expect(
        certificadoNFT.connect(certificadora).revocarCertificado(1, motivoHash)
      ).to.emit(certificadoNFT, "CertificadoRevocado");

      const cert = await certificadoNFT.certificados(1);
      expect(cert.revocado).to.be.true;
      expect(await certificadoNFT.esCertificadoValido(1)).to.be.false;
    });

    it("Lote queda REVOCADO en LoteRegistry", async () => {
      const motivoHash = ethers.keccak256(ethers.toUtf8Bytes("motivo"));
      await certificadoNFT.connect(certificadora).revocarCertificado(1, motivoHash);
      const lote = await loteRegistry.lotes(LOTE_ID);
      expect(lote.estado).to.equal(7); // REVOCADO
    });

    it("No se puede revocar dos veces", async () => {
      const motivoHash = ethers.keccak256(ethers.toUtf8Bytes("motivo"));
      await certificadoNFT.connect(certificadora).revocarCertificado(1, motivoHash);
      await expect(
        certificadoNFT.connect(certificadora).revocarCertificado(1, motivoHash)
      ).to.be.revertedWith("AgroChain: Ya esta revocado");
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  describe("Gas estimado (informativo)", () => {
    it("Registrar lote", async () => {
      const tx = await loteRegistry.connect(agricultor).registrarLote.populateTransaction(LOTE_ID, DATA_HASH);
      const gas = await ethers.provider.estimateGas({ ...tx, from: agricultor.address });
      console.log(`      Gas registrarLote: ${gas.toString()}`);
      expect(gas).to.be.lessThan(200_000n);
    });

    it("Registrar evento", async () => {
      await loteRegistry.connect(agricultor).registrarLote(LOTE_ID, DATA_HASH);
      const tx = await loteRegistry.connect(agricultor).registrarEvento.populateTransaction(LOTE_ID, "SIEMBRA", EVID_HASH);
      const gas = await ethers.provider.estimateGas({ ...tx, from: agricultor.address });
      console.log(`      Gas registrarEvento: ${gas.toString()}`);
      expect(gas).to.be.lessThan(200_000n);
    });
  });
});

// Helper para timestamps en tests
async function getTimestamp(): Promise<bigint> {
  const block = await ethers.provider.getBlock("latest");
  return BigInt(block!.timestamp + 1);
}
