// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Escrow {
    enum Estado {
        CRIADO,
        DEPOSITADO,
        ENTREGUE,
        FINALIZADO
    }

    address public contratante; 
    address public prestador;
    uint256 public valor;
    Estado public estado;
    uint256 dataEntrega = 0;

    constructor(address _contratante, address _prestador, uint256 _valor) {
        contratante = _contratante;
        prestador = _prestador;
        valor = _valor;
        estado = Estado.CRIADO;
    }
}