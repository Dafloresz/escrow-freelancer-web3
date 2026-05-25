// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./Escrow.sol";

contract EscrowFactory {

    // Array para salvar os endereços de todos os Escrow criados
    address[] public todosOsEscrows;

    // Mapping para acahr os escrows de um usuario específico
    mapping(address => address[]) public escrowUsuario;

    function criaEscrow(address _prestador, uint256 _valor) public payable {
        address contratanteAtual = msg.sender;
        Escrow escrow = new Escrow{value: msg.value}(contratanteAtual, _prestador, _valor);

        // pega o endereço do escrow que acabamos de criar
        address enderecoEscrow = address(escrow);

        // adiciona o endereço do escrow na lista global (todosOsEscrows)
        todosOsEscrows.push(enderecoEscrow);

        // salva na lista específica de quem criou (contratante)
        escrowUsuario[msg.sender].push(enderecoEscrow);

        // salva na lista específica de quem vai receber (prestador)
        escrowUsuario[_prestador].push(enderecoEscrow);
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