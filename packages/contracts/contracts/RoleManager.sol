// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title RoleManager
 * @notice Gestiona roles y permisos del sistema AgroChain.
 *         Integra los roles definidos en la normativa colombiana:
 *         ICA (Instituto Colombiano Agropecuario) y NTC 5400 BPA.
 */
contract RoleManager is AccessControl {
    // ── ROLES ────────────────────────────────────────────────────────────────
    bytes32 public constant AGRICULTOR_ROLE    = keccak256("AGRICULTOR");
    bytes32 public constant INSPECTOR_ICA_ROLE = keccak256("INSPECTOR_ICA");
    bytes32 public constant INSPECTOR_BPA_ROLE = keccak256("INSPECTOR_BPA");
    bytes32 public constant CERTIFICADORA_ROLE = keccak256("CERTIFICADORA");
    bytes32 public constant INVIMA_ROLE        = keccak256("INVIMA");

    // ── EVENTOS ──────────────────────────────────────────────────────────────
    event RolAsignado(address indexed cuenta, bytes32 indexed rol, address indexed asignadoPor);
    event RolRevocado(address indexed cuenta, bytes32 indexed rol, address indexed revocadoPor);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /**
     * @notice Asigna rol a una cuenta. Solo el admin puede hacerlo.
     */
    function asignarRol(address cuenta, bytes32 rol) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(rol, cuenta);
        emit RolAsignado(cuenta, rol, msg.sender);
    }

    /**
     * @notice Revoca rol de una cuenta.
     */
    function revocarRol(address cuenta, bytes32 rol) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(rol, cuenta);
        emit RolRevocado(cuenta, rol, msg.sender);
    }

    // ── VERIFICADORES ────────────────────────────────────────────────────────
    function esAgricultor(address cuenta)    external view returns (bool) { return hasRole(AGRICULTOR_ROLE, cuenta); }
    function esInspectorIca(address cuenta)  external view returns (bool) { return hasRole(INSPECTOR_ICA_ROLE, cuenta); }
    function esInspectorBpa(address cuenta)  external view returns (bool) { return hasRole(INSPECTOR_BPA_ROLE, cuenta); }
    function esCertificadora(address cuenta) external view returns (bool) { return hasRole(CERTIFICADORA_ROLE, cuenta); }
    function esInvima(address cuenta)        external view returns (bool) { return hasRole(INVIMA_ROLE, cuenta); }
}
