// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

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

    modifier somentePrestador {
        require(msg.sender == prestador, "Somente o prestador pode chamar essa funcao!");
        _;
    }

    modifier somenteContrante {
        require(msg.sender == contratante, "Somente o contrante pode chamar essa funcao!");
        _;
        
    }

    constructor(address _contratante, address _prestador, uint256 _valor) {
        contratante = _contratante;
        prestador = _prestador;
        valor = _valor;
        estado = Estado.CRIADO;
    }
    
    function depositar() public payable {
        require(msg.sender == contratante, "Somente o contratante pode depositar!");
        require(estado == Estado.CRIADO, "Estado do contrato precisa ser criado!");
        require(msg.value == valor, "Dinheiro Insuficiente");
        estado = Estado.DEPOSITADO;
    }

    function entregarServico() public somentePrestador {
        require(estado == Estado.DEPOSITADO, "Dinheiro ainda nao estar depositado");
        estado = Estado.ENTREGUE;
        dataEntrega = block.timestamp;
    }

    // O contratante aprova o serviço e libera o dinheiro para o prestador
    function pagarPrestador() public somenteContrante {
        require(estado == Estado.ENTREGUE, "Projeto ainda nao foi entregue!");

        // Atualiza o estado antes de transferir evitando ataque de reentrada
        estado = Estado.FINALIZADO;
        (bool sucesso, ) = payable(prestador).call{value: address(this).balance}("");
        require(sucesso, "A transferencia falhou");   
        
    }

    // O prestador saca o dinheiro sozinho se o contratante sumir por mais de 3 dias
    function pagarPorPrazoExpirado() public somentePrestador{
        require(estado == Estado.ENTREGUE, "Projeto ainda nao foi entregue");
        require(block.timestamp >= dataEntrega + 3 days, "Prazo de 3 dias nao expirou");

        estado = Estado.FINALIZADO;
        (bool sucesso, ) = payable(prestador).call{value: address(this).balance}("");
        require(sucesso, "A transferencia falhou");
    }
}