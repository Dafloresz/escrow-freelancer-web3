// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(
        string memory nome,
        string memory simbolo,
        address destinatario,
        uint256 quantidadeInicial
    ) ERC20(nome, simbolo) {
        _mint(destinatario, quantidadeInicial);
    }
}