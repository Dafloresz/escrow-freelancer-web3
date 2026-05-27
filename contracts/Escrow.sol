// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract Escrow {
    enum Estado {
        CRIADO,
        ACEITO,
        DEPOSITADO,
        ENTREGUE,
        FINALIZADO,
        EM_DISPUTA
    }

    address public contratante; 
    address public prestador;
    address public arbitro;
    uint256 public valor;
    Estado public estado;
    uint256 public dataEntrega = 0;
    uint256 public dataDeposito = 0;

    event ContratoAceito(address prestador, uint256 timestamp);
    event ServicoDepositado(address indexed contratante, uint256 valor, uint256 timestamp);
    event ServicoEntregue(address indexed prestador, uint256 timestamp);
    event PagamentoRealizado(address indexed prestador, uint256 valor);
    event ReembolsoRealizado(address indexed contratante, uint256 valor);
    event DisputaIniciada(address porQuem, uint256 timestamp);
    event DisputaResolvida(address vencedor, uint256 valor);


    modifier somentePrestador {
        require(msg.sender == prestador, "Somente o prestador pode chamar essa funcao!");
        _;
    }

    modifier somenteContratante {
        require(msg.sender == contratante, "Somente o contratante pode chamar essa funcao!");
        _;  
    }

    modifier somenteArbitro() {
        require(msg.sender == arbitro, "Somente o arbitro pode resolver");
        _;
    }

    constructor(address _contratante, address _prestador, address _arbitro, uint256 _valor) {
        contratante = _contratante;
        prestador = _prestador;
        arbitro = _arbitro;
        valor = _valor;
        estado = Estado.CRIADO;
    }
    
    function aceitarContrato()  external somentePrestador{
        require(estado == Estado.CRIADO, "Contrato ainda nao criado");
         estado = Estado.ACEITO;

         emit ContratoAceito(prestador, block.timestamp);
    }

    function depositar() public payable somenteContratante {
        require(estado == Estado.ACEITO, "O prestador precisa aceitar o contrato primeiro!");
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

    function iniciarDisputa() public {
        // Garante que somente partes envolvidas no contrato podem iniciar disputas
        require(msg.sender == contratante || msg.sender == prestador, "Somente partes envolvidas podem abrir disputa");

        // Garante que o dinheiro esteja depositado ou o servico esteja entrgue
        require(estado == Estado.DEPOSITADO || estado == Estado.ENTREGUE, "Estado invalido para disputa");

        // colocamos o estado do contrato EM_DIPUSTA para que o dinheiro fique preso e as outras funções fiquem desabilitadas
        estado = Estado.EM_DISPUTA;
        emit DisputaIniciada(msg.sender, block.timestamp);
    }

    // arbitro chama a funcao resolverDisputa, enviando um bool como parametro
    // true caso o prestador tiver certo e false caso o contratante esteja certo
    function resolverDisputa(bool decisaoDoPrestador) public somenteArbitro {
        // Grante que o arbitro só pode agir se alguém tiver chamado a funcao iniciarDisputa() (contratante/prestador)
        require(estado == Estado.EM_DISPUTA, "Contrato nao esta em disputa");

        // Marca o contrato como concluído para que não possa ser alterado novamente.
        estado = Estado.FINALIZADO;

        // Tranca todo o dinheiro do contrato
        uint256 saldo = address(this).balance;

        if(decisaoDoPrestador) {
            // Se o árbitro mandou true o dinheiro vai para o prestador
            (bool sucess, ) = prestador.call{value: saldo}("");
            require(sucess, "Falha ao pagar prestador");
            emit DisputaResolvida(prestador, saldo);

        } else {
            // Se o árbitro mandou false o dinheiro volta para o contratante
            (bool sucess, ) = contratante.call{value: saldo}("");
            require(sucess, "Falha ao reembolsar contratante");
            emit DisputaResolvida(contratante, saldo);
        }

    }
}