// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./Escrow.sol";

contract EscrowFactory {

    // Array para salvar os endereços de todos os Escrow criados
    address[] public todosOsEscrows;

    // Mapping para acahr os escrows de um usuario específico
    mapping(address => address[]) public escrowUsuario;

    event EscrowCriado(
        address indexed contratante,
        address indexed prestador,
        address indexed arbitro,
        address tokenPagamento,
        address escrow,
        uint256 valor
    );

    function criaEscrow(address _prestador, address _arbitro, address _tokenPagamento, uint256 _valor) public {
        address contratanteAtual = msg.sender;

        // Implementa mais seguranca ao criar o contrato
        // evita que alguem passe um endereco invalido, podendo ter ETH preso para sempre no contrato
        require(_prestador != address(0), "Endereco do prestador invalido!");
        require(_arbitro != address(0), "Endereco do arbitro invalido");
        require(_tokenPagamento != address(0), "Endereco do token de pagamento invalido!");

        // evita de alguem depositar e aprovar o proprio servico, usando a plataforma como lavagem de dinheiro
        require(_prestador != contratanteAtual, "Contratante e prestador nao podem ser o mesmo!");

        // garante que o arbitro não seja a carteira do prestador e do contratante
        require(contratanteAtual != _arbitro && _prestador != _arbitro, "Arbitro deve ser um terceiro neutro");

        // evita de alguem criar um servico que nao vale nada
        require(_valor > 0, "O valor do servico deve ser maior que zero!");

        // cria nosso contrato Escrow
        Escrow escrow = new Escrow(contratanteAtual, _prestador, _arbitro, _tokenPagamento, _valor);

        // pega o endereço do escrow que acabamos de criar
        address enderecoEscrow = address(escrow);

        // adiciona o endereço do escrow na lista global (todosOsEscrows)
        todosOsEscrows.push(enderecoEscrow);

        // salva na lista específica de quem criou (contratante)
        escrowUsuario[msg.sender].push(enderecoEscrow);

        // salva na lista específica de quem vai receber (prestador)
        escrowUsuario[_prestador].push(enderecoEscrow);

        emit EscrowCriado(msg.sender, _prestador, _arbitro, _tokenPagamento, enderecoEscrow, _valor);
    }

    // retorna todos os escrows criados na plataforma
    function exibirTodosEscrow() public view returns (address[] memory) {
        return todosOsEscrows;
    }

    // retorna apenas o(s) escrow do usuario passado pelo paramêtro
    function exibirEscrowUsuarioEspecifico(address _usuario) public view returns (address[] memory) {
        return escrowUsuario[_usuario];
    }
}