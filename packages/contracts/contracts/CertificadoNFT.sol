// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./RoleManager.sol";
import "./LoteRegistry.sol";

/**
 * @title CertificadoNFT
 * @notice Certificado de cultivo como NFT ERC-721 en Polygon.
 *
 * Cada token representa UN certificado oficial de un lote agricola.
 * El token es transferible — el agricultor puede venderlo junto al producto.
 * El tokenURI apunta a metadata JSON en IPFS con todos los detalles del certificado.
 *
 * Tipos de certificado soportados (normativa Colombia):
 *   - BPA_ICA: Buenas Practicas Agricolas (ICA - NTC 5400)
 *   - ORGANICO: Produccion organica certificada
 *   - GLOBAL_GAP: Norma internacional GlobalG.A.P
 *   - RAINFOREST: Rainforest Alliance
 *   - INVIMA_INOCUIDAD: Certificado INVIMA inocuidad alimentaria
 */
contract CertificadoNFT is ERC721, ERC721URIStorage, Ownable {
    // ── TIPOS ─────────────────────────────────────────────────────────────────

    enum TipoCertificado {
        BPA_ICA,
        ORGANICO,
        GLOBAL_GAP,
        RAINFOREST,
        INVIMA_INOCUIDAD
    }

    struct MetadataCertificado {
        bytes32          loteId;              // ID del lote en LoteRegistry
        string           numeroCertificado;   // Nro. oficial (ej: "BPA-ANT-2024-00001")
        TipoCertificado  tipo;
        address          certificadora;       // Quien certifico
        address          agricultor;          // Dueno original del lote
        uint256          fechaEmision;        // block.timestamp
        uint256          fechaVencimiento;    // timestamp de vencimiento
        bool             revocado;
    }

    // ── ESTADO ────────────────────────────────────────────────────────────────

    RoleManager   public immutable roleManager;
    LoteRegistry  public immutable loteRegistry;

    uint256 private _tokenIdCounter;

    // tokenId → metadata del certificado
    mapping(uint256 => MetadataCertificado) public certificados;

    // loteId → tokenId (un lote = un certificado activo)
    mapping(bytes32 => uint256) public loteACertificado;
    mapping(bytes32 => bool)    public loteYaCertificado;

    // numeroCertificado → tokenId (unicidad del numero oficial)
    mapping(string => bool) public numeroUsado;

    // ── EVENTOS ───────────────────────────────────────────────────────────────

    event CertificadoEmitido(
        uint256 indexed tokenId,
        bytes32 indexed loteId,
        address indexed agricultor,
        string  numeroCertificado,
        TipoCertificado tipo,
        uint256 fechaVencimiento
    );

    event CertificadoRevocado(
        uint256 indexed tokenId,
        bytes32 indexed loteId,
        address  revocadoPor,
        uint256  timestamp
    );

    // ── MODIFICADORES ─────────────────────────────────────────────────────────

    modifier soloCertificadora() {
        require(
            roleManager.esCertificadora(msg.sender),
            "AgroChain: Solo certificadoras pueden emitir certificados"
        );
        _;
    }

    // ── CONSTRUCTOR ───────────────────────────────────────────────────────────

    constructor(
        address _roleManager,
        address _loteRegistry,
        address _admin
    ) ERC721("AgroChain Certificado", "AGROCERT") Ownable(_admin) {
        roleManager  = RoleManager(_roleManager);
        loteRegistry = LoteRegistry(_loteRegistry);
    }

    // ── EMISION ───────────────────────────────────────────────────────────────

    /**
     * @notice Emite el NFT certificado para un lote aprobado.
     * @param loteId            ID del lote en LoteRegistry
     * @param agricultor        Wallet que recibe el NFT
     * @param numeroCertificado Numero oficial unico del certificado
     * @param tipo              Tipo de certificacion
     * @param diasVigencia      Dias de vigencia desde hoy (ej: 365 para 1 año)
     * @param ipfsUri           URI IPFS con el JSON completo de metadata del NFT
     *
     * Prerequisitos:
     *   1. El lote debe existir en LoteRegistry
     *   2. El lote debe estar en estado COSECHADO (paso previo a CERTIFICADO)
     *   3. El lote no debe tener certificado activo
     *   4. El numero de certificado debe ser unico
     */
    function emitirCertificado(
        bytes32         loteId,
        address         agricultor,
        string calldata numeroCertificado,
        TipoCertificado tipo,
        uint256         diasVigencia,
        string calldata ipfsUri
    ) external soloCertificadora returns (uint256 tokenId) {
        require(!loteYaCertificado[loteId],          "AgroChain: Lote ya tiene certificado activo");
        require(!numeroUsado[numeroCertificado],      "AgroChain: Numero de certificado ya existe");
        require(bytes(numeroCertificado).length > 0, "AgroChain: Numero requerido");
        require(bytes(ipfsUri).length > 0,           "AgroChain: URI IPFS requerida");
        require(diasVigencia > 0 && diasVigencia <= 1825, "AgroChain: Vigencia entre 1 y 1825 dias"); // max 5 años
        require(agricultor != address(0),            "AgroChain: Wallet agricultor invalida");

        // Verificar que el lote existe y esta listo para certificar
        (
            ,          // dataHash
            address loteDueno,
            ,          // certificadora
            LoteRegistry.EstadoLote estado,
            ,          // creadoEn
            ,          // actualizadoEn
            bool existe
        ) = loteRegistry.lotes(loteId);

        require(existe,  "AgroChain: Lote no registrado en blockchain");
        require(
            estado == LoteRegistry.EstadoLote.COSECHADO,
            "AgroChain: Lote debe estar en estado COSECHADO"
        );
        require(loteDueno == agricultor, "AgroChain: Agricultor no coincide con dueno del lote");

        // Mint del NFT
        tokenId = ++_tokenIdCounter;
        _safeMint(agricultor, tokenId);
        _setTokenURI(tokenId, ipfsUri);

        uint256 vencimiento = block.timestamp + (diasVigencia * 1 days);

        // Guardar metadata
        certificados[tokenId] = MetadataCertificado({
            loteId:             loteId,
            numeroCertificado:  numeroCertificado,
            tipo:               tipo,
            certificadora:      msg.sender,
            agricultor:         agricultor,
            fechaEmision:       block.timestamp,
            fechaVencimiento:   vencimiento,
            revocado:           false
        });

        loteACertificado[loteId]   = tokenId;
        loteYaCertificado[loteId]  = true;
        numeroUsado[numeroCertificado] = true;

        // Actualizar estado en LoteRegistry
        loteRegistry.certificarLote(loteId);

        emit CertificadoEmitido(
            tokenId,
            loteId,
            agricultor,
            numeroCertificado,
            tipo,
            vencimiento
        );
    }

    // ── REVOCACION ────────────────────────────────────────────────────────────

    /**
     * @notice Revoca un certificado emitido.
     * @param tokenId     ID del NFT a revocar
     * @param motivoHash  keccak256 del documento de motivo (en IPFS)
     */
    function revocarCertificado(uint256 tokenId, bytes32 motivoHash)
        external
        soloCertificadora
    {
        require(_ownerOf(tokenId) != address(0), "AgroChain: Token no existe");
        MetadataCertificado storage cert = certificados[tokenId];
        require(!cert.revocado, "AgroChain: Ya esta revocado");

        cert.revocado = true;
        loteYaCertificado[cert.loteId] = false;

        // Propagar revocacion al LoteRegistry
        loteRegistry.revocarCertificado(cert.loteId, motivoHash);

        emit CertificadoRevocado(tokenId, cert.loteId, msg.sender, block.timestamp);
    }

    // ── LECTURA ───────────────────────────────────────────────────────────────

    /**
     * @notice Verifica si un certificado es valido (no revocado y no vencido).
     */
    function esCertificadoValido(uint256 tokenId) external view returns (bool) {
        if (_ownerOf(tokenId) == address(0)) return false;
        MetadataCertificado memory cert = certificados[tokenId];
        return !cert.revocado && block.timestamp <= cert.fechaVencimiento;
    }

    /**
     * @notice Retorna el total de certificados emitidos.
     */
    function totalCertificados() external view returns (uint256) {
        return _tokenIdCounter;
    }

    // ── OVERRIDES ERC721 ──────────────────────────────────────────────────────

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
