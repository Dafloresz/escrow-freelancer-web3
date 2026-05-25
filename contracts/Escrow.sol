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
    uint256 public dataEntrega = 0;
    uint256 public dataDeposito = 0;

    event ServicoDepositado(address indexed contratante, uint256 valor, uint256 timestamp);
    event ServicoEntregue(address indexed prestador, uint256 timestamp);
    event PagamentoRealizado(address indexed prestador, uint256 valor);
    event ReembolsoRealizado(address indexed contratante, uint256 valor);


    modifier somentePrestador {
        require(msg.sender == prestador, "Somente o prestador pode chamar essa funcao!");
        _;
    }

    modifier somenteContratante {
        require(msg.sender == contratante, "Somente o contrante pode chamar essa funcao!");
        _;  
    }

    constructor(address _contratante, address _prestador, uint256 _valor) {
        contratante = _contratante;
        prestador = _prestador;
        valor = _valor;
        estado = Estado.CRIADO;
    }
    
    function depositar() public payable somenteContratante {
        require(estado == Estado.CRIADO, "Estado do contrato precisa ser criado!");
        require(msg.value == valor, "Dinheiro Insuficiente");
        estado = Estado.DEPOSITADO;
        dataDeposito = block.timestamp;
        emit ServicoDepositado(contratante, msg.value, block.timestamp);
    }

    function entregarServico() public somentePrestador {
        require(estado == Estado.DEPOSITADO, "Dinheiro ainda nao estar depositado");
        estado = Estado.ENTREGUE;
        dataEntrega = block.timestamp;
        emit ServicoEntregue(prestador, block.timestamp);
    }

    // O contratante aprova o serviço e libera o dinheiro para o prestador
    function pagarPrestador() public somenteContratante {
        require(estado == Estado.ENTREGUE, "Projeto ainda nao foi entregue!");

        // Atualiza o estado antes de transferir evitando ataque de reentrada
        estado = Estado.FINALIZADO;
        uint256 saldo = address(this).balance;
        (bool sucesso, ) = payable(prestador).call{value: saldo}("");
        require(sucesso, "A transferencia falhou!");
        emit PagamentoRealizado(prestador, saldo);
        
    }

    // O prestador saca o dinheiro sozinho se o contratante sumir por mais de 3 dias
    function pagarPorPrazoExpirado() public somentePrestador{
        require(estado == Estado.ENTREGUE, "Projeto ainda nao foi entregue");
        require(block.timestamp >= dataEntrega + 3 days, "Prazo de 3 dias nao expirou");
        estado = Estado.FINALIZADO;

        uint256 saldo = address(this).balance;
        (bool sucesso, ) = payable(prestador).call{value: saldo}("");
        require(sucesso, "A transferencia falhou!");
        emit PagamentoRealizado(prestador, saldo);
    }

    // Contratante se reembolsa se o prestador sumir por mais de 30 dias após o depósito
    function reembolsar() public somenteContratante {
        require(estado == Estado.DEPOSITADO, "Nao tem deposito para reembolsar!");
        require(block.timestamp >= dataDeposito + 30 days, "Aguarde 30 dias para poder reembolsar!");

        estado = Estado.FINALIZADO;
        uint256 saldo = address(this).balance;
        (bool sucesso, ) = payable(contratante).call{value: saldo}("");
        require(sucesso, "A transferencia falhou!");
        emit ReembolsoRealizado(contratante, saldo);
    }
}