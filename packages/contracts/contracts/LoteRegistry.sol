// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./RoleManager.sol";

/**
 * @title LoteRegistry
 * @notice Registra lotes agricolas y sus eventos de trazabilidad on-chain.
 *
 * Estrategia off-chain / on-chain:
 *   - Los datos completos (fotos, formularios, GPS) viven en la DB off-chain (Turso/SQLite).
 *   - On-chain se guarda SOLO el hash SHA256/keccak256 de esos datos.
 *   - Cualquiera puede verificar que un dato off-chain no fue alterado
 *     recalculando su hash y comparando con el que esta en Polygon.
 *
 * Cumplimiento normativo Colombia:
 *   - Trazabilidad requerida por NTC 5400 (BPA) numeral 4.11
 *   - Registro de eventos de produccion (ICA, fumigacion, cosecha)
 */
contract LoteRegistry {
    // ── TIPOS ─────────────────────────────────────────────────────────────────

    enum EstadoLote {
        REGISTRADO,            // Lote creado
        EN_PRODUCCION,         // Ciclo activo
        COSECHADO,             // Cosecha registrada
        INSPECCION_SOLICITADA, // Aguardando inspector
        EN_INSPECCION,         // Inspector asignado y en proceso
        CERTIFICADO,           // NFT emitido
        RECHAZADO,             // Inspeccion rechazada
        REVOCADO               // Certificado revocado
    }

    struct Lote {
        bytes32  dataHash;       // keccak256 de datos off-chain al registrar
        address  agricultor;     // Wallet del agricultor
        address  certificadora;  // Wallet de la certificadora (se asigna al certificar)
        EstadoLote estado;
        uint256  creadoEn;       // block.timestamp
        uint256  actualizadoEn;
        bool     existe;
    }

    struct EventoLog {
        string   tipoEvento;     // "SIEMBRA", "RIEGO", "CONTROL_PLAGAS", etc.
        bytes32  evidenciaHash;  // keccak256 del hash SHA256 de la evidencia IPFS
        address  registradoPor;  // Wallet del tecnico
        uint256  timestamp;
    }

    // ── ESTADO ────────────────────────────────────────────────────────────────

    RoleManager public immutable roleManager;

    // loteId (bytes32) → Lote
    mapping(bytes32 => Lote) public lotes;

    // loteId → lista de eventos
    mapping(bytes32 => EventoLog[]) public eventos;

    // Total de lotes registrados
    uint256 public totalLotes;

    // Direccion del contrato CertificadoNFT — unico autorizado a llamar certificarLote/revocarCertificado
    address public certificadoNFTContract;

    // ── EVENTOS SOLIDITY ──────────────────────────────────────────────────────

    event LoteRegistrado(
        bytes32 indexed loteId,
        address indexed agricultor,
        bytes32 dataHash,
        uint256 timestamp
    );

    event EventoRegistrado(
        bytes32 indexed loteId,
        string  tipoEvento,
        bytes32 evidenciaHash,
        address registradoPor,
        uint256 timestamp
    );

    event EstadoCambiado(
        bytes32 indexed loteId,
        EstadoLote estadoAnterior,
        EstadoLote estadoNuevo,
        address  cambiadoPor,
        uint256  timestamp
    );

    event CertificadoraAsignada(
        bytes32 indexed loteId,
        address indexed certificadora,
        uint256 timestamp
    );

    // ── MODIFICADORES ─────────────────────────────────────────────────────────

    modifier soloAgricultor() {
        require(
            roleManager.esAgricultor(msg.sender),
            "AgroChain: Solo agricultores pueden ejecutar esta accion"
        );
        _;
    }

    modifier soloInspector() {
        require(
            roleManager.esInspectorIca(msg.sender) ||
            roleManager.esInspectorBpa(msg.sender),
            "AgroChain: Solo inspectores pueden ejecutar esta accion"
        );
        _;
    }

    modifier soloCertificadora() {
        require(
            roleManager.esCertificadora(msg.sender),
            "AgroChain: Solo certificadoras pueden ejecutar esta accion"
        );
        _;
    }

    // Solo el contrato CertificadoNFT puede llamar certificarLote y revocarCertificado
    modifier soloCertificadoNFT() {
        require(
            msg.sender == certificadoNFTContract,
            "AgroChain: Solo CertificadoNFT puede llamar esta funcion"
        );
        _;
    }

    modifier loteExiste(bytes32 loteId) {
        require(lotes[loteId].existe, "AgroChain: Lote no existe");
        _;
    }

    // ── CONSTRUCTOR ───────────────────────────────────────────────────────────

    constructor(address _roleManager) {
        roleManager = RoleManager(_roleManager);
    }

    /**
     * @notice Registra el contrato CertificadoNFT como llamador autorizado.
     *         Solo puede llamarse una vez (inmutable despues de setear).
     */
    function setCertificadoNFT(address _certificadoNFT) external {
        require(certificadoNFTContract == address(0), "AgroChain: Ya configurado");
        require(_certificadoNFT != address(0), "AgroChain: Direccion invalida");
        certificadoNFTContract = _certificadoNFT;
    }

    // ── FUNCIONES PRINCIPALES ─────────────────────────────────────────────────

    /**
     * @notice Registra un nuevo lote agricola on-chain.
     * @param loteId     ID unico del lote (keccak256 del codigoLote off-chain)
     * @param dataHash   Hash SHA256 → keccak256 de todos los datos del lote
     *
     * El agricultor llama esta funcion cuando sincroniza un lote nuevo a la nube.
     * El backend calcula loteId = keccak256(codigoLote) y dataHash = keccak256(sha256(datosJSON)).
     */
    function registrarLote(
        bytes32 loteId,
        bytes32 dataHash
    ) external soloAgricultor {
        require(!lotes[loteId].existe, "AgroChain: Lote ya registrado");
        require(dataHash != bytes32(0), "AgroChain: dataHash no puede ser cero");

        lotes[loteId] = Lote({
            dataHash:      dataHash,
            agricultor:    msg.sender,
            certificadora: address(0),
            estado:        EstadoLote.REGISTRADO,
            creadoEn:      block.timestamp,
            actualizadoEn: block.timestamp,
            existe:        true
        });

        totalLotes++;

        emit LoteRegistrado(loteId, msg.sender, dataHash, block.timestamp);
    }

    /**
     * @notice Registra un evento de produccion (siembra, riego, fumigacion, etc.).
     * @param loteId        ID del lote
     * @param tipoEvento    Tipo segun NTC 5400 ("SIEMBRA", "RIEGO", etc.)
     * @param evidenciaHash keccak256 del SHA256 de la evidencia subida a IPFS
     *
     * Cualquier tecnico autorizado (agricultor o inspector) puede registrar eventos.
     * El hash se calcula en el backend: keccak256(abi.encodePacked(sha256OffChain))
     */
    function registrarEvento(
        bytes32 loteId,
        string  calldata tipoEvento,
        bytes32 evidenciaHash
    ) external loteExiste(loteId) {
        require(
            roleManager.esAgricultor(msg.sender) ||
            roleManager.esInspectorIca(msg.sender) ||
            roleManager.esInspectorBpa(msg.sender),
            "AgroChain: Sin permiso para registrar eventos"
        );
        require(
            lotes[loteId].estado != EstadoLote.REVOCADO &&
            lotes[loteId].estado != EstadoLote.RECHAZADO,
            "AgroChain: Lote en estado final, no acepta eventos"
        );
        require(bytes(tipoEvento).length > 0, "AgroChain: tipoEvento requerido");
        require(evidenciaHash != bytes32(0), "AgroChain: evidenciaHash requerido");

        eventos[loteId].push(EventoLog({
            tipoEvento:    tipoEvento,
            evidenciaHash: evidenciaHash,
            registradoPor: msg.sender,
            timestamp:     block.timestamp
        }));

        // Avanzar estado automaticamente al registrar primer evento
        if (lotes[loteId].estado == EstadoLote.REGISTRADO) {
            _cambiarEstado(loteId, EstadoLote.EN_PRODUCCION);
        }

        lotes[loteId].actualizadoEn = block.timestamp;

        emit EventoRegistrado(loteId, tipoEvento, evidenciaHash, msg.sender, block.timestamp);
    }

    /**
     * @notice Agricultor solicita inspeccion del lote.
     */
    function solicitarInspeccion(bytes32 loteId)
        external
        soloAgricultor
        loteExiste(loteId)
    {
        Lote storage lote = lotes[loteId];
        require(lote.agricultor == msg.sender, "AgroChain: Solo el dueno puede solicitar inspeccion");
        require(
            lote.estado == EstadoLote.EN_PRODUCCION ||
            lote.estado == EstadoLote.COSECHADO,
            "AgroChain: Estado invalido para solicitar inspeccion"
        );

        _cambiarEstado(loteId, EstadoLote.INSPECCION_SOLICITADA);
    }

    /**
     * @notice Inspector marca inicio de inspeccion en campo.
     */
    function iniciarInspeccion(bytes32 loteId)
        external
        soloInspector
        loteExiste(loteId)
    {
        require(
            lotes[loteId].estado == EstadoLote.INSPECCION_SOLICITADA,
            "AgroChain: Inspeccion no solicitada"
        );
        _cambiarEstado(loteId, EstadoLote.EN_INSPECCION);
    }

    /**
     * @notice Inspector registra resultado de inspeccion.
     * @param aprobado       true = aprobado, false = rechazado
     * @param reporteHash    keccak256 del PDF del reporte de inspeccion (en IPFS)
     */
    function registrarResultadoInspeccion(
        bytes32 loteId,
        bool    aprobado,
        bytes32 reporteHash
    ) external soloInspector loteExiste(loteId) {
        require(
            lotes[loteId].estado == EstadoLote.EN_INSPECCION,
            "AgroChain: Inspeccion no iniciada"
        );
        require(reporteHash != bytes32(0), "AgroChain: reporteHash requerido");

        // El reporte queda como evento especial
        eventos[loteId].push(EventoLog({
            tipoEvento:    "REPORTE_INSPECCION",
            evidenciaHash: reporteHash,
            registradoPor: msg.sender,
            timestamp:     block.timestamp
        }));

        EstadoLote nuevoEstado = aprobado
            ? EstadoLote.COSECHADO   // Listo para certificacion
            : EstadoLote.RECHAZADO;

        _cambiarEstado(loteId, nuevoEstado);

        emit EventoRegistrado(loteId, "REPORTE_INSPECCION", reporteHash, msg.sender, block.timestamp);
    }

    /**
     * @notice Asigna certificadora al lote (paso previo a emitir NFT).
     */
    function asignarCertificadora(
        bytes32 loteId,
        address certificadora
    ) external soloCertificadora loteExiste(loteId) {
        require(
            lotes[loteId].estado == EstadoLote.COSECHADO,
            "AgroChain: Lote debe estar en estado COSECHADO"
        );
        require(certificadora != address(0), "AgroChain: Direccion invalida");

        lotes[loteId].certificadora = certificadora;
        emit CertificadoraAsignada(loteId, certificadora, block.timestamp);
    }

    /**
     * @notice Certifica el lote — llamado por CertificadoNFT al emitir el NFT.
     */
    function certificarLote(bytes32 loteId)
        external
        soloCertificadoNFT
        loteExiste(loteId)
    {
        require(
            lotes[loteId].estado == EstadoLote.COSECHADO,
            "AgroChain: Lote debe estar en estado COSECHADO para certificar"
        );
        _cambiarEstado(loteId, EstadoLote.CERTIFICADO);
    }

    /**
     * @notice Revoca un certificado emitido.
     */
    function revocarCertificado(bytes32 loteId, bytes32 motivoHash)
        external
        soloCertificadoNFT
        loteExiste(loteId)
    {
        require(
            lotes[loteId].estado == EstadoLote.CERTIFICADO,
            "AgroChain: Solo se pueden revocar lotes certificados"
        );

        eventos[loteId].push(EventoLog({
            tipoEvento:    "REVOCACION",
            evidenciaHash: motivoHash,
            registradoPor: msg.sender,
            timestamp:     block.timestamp
        }));

        _cambiarEstado(loteId, EstadoLote.REVOCADO);
    }

    // ── FUNCIONES DE LECTURA ──────────────────────────────────────────────────

    /**
     * @notice Retorna el numero de eventos de un lote.
     */
    function totalEventos(bytes32 loteId) external view returns (uint256) {
        return eventos[loteId].length;
    }

    /**
     * @notice Retorna un evento especifico de un lote.
     */
    function getEvento(bytes32 loteId, uint256 index)
        external
        view
        returns (EventoLog memory)
    {
        require(index < eventos[loteId].length, "AgroChain: Indice fuera de rango");
        return eventos[loteId][index];
    }

    /**
     * @notice Verifica si el hash off-chain coincide con el registrado on-chain.
     *         Cualquiera puede llamar esta funcion para verificar integridad.
     */
    function verificarIntegridad(bytes32 loteId, bytes32 hashAVerificar)
        external
        view
        loteExiste(loteId)
        returns (bool)
    {
        return lotes[loteId].dataHash == hashAVerificar;
    }

    // ── INTERNO ───────────────────────────────────────────────────────────────

    function _cambiarEstado(bytes32 loteId, EstadoLote nuevoEstado) internal {
        EstadoLote anterior = lotes[loteId].estado;
        lotes[loteId].estado = nuevoEstado;
        lotes[loteId].actualizadoEn = block.timestamp;
        emit EstadoCambiado(loteId, anterior, nuevoEstado, msg.sender, block.timestamp);
    }
}
