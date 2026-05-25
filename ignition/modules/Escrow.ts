import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseEther } from "viem";

// Script usado apenas para teste - deploy direto do contrato filho
export default buildModule("EscrowModule", (m) => {
  // Defina os 3 parâmetros que o construtor da contrato Escrow exige
  
  // Quem está simulando o papel de contratante no deploy direto
  const enderecoContratante = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // Conta 1 padrão do Hardhat (usada em testes)
  
  // Quem vai receber o serviço (Prestador)
  const enderecoPrestador = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";    // Conta 2 padrão do Hardhat (usada em testes)
  
  // Valor do contrato transformado em Wei (0.1 ETH) equivalente a 100000000000000000 wei
  const valorDoProjeto = parseEther("0.1");

  // Executa o deploy passando os 3 argumentos
  // feito os teste, não vamos mais usar o {value: valorDoProjeto} pois quem envia ETH para o contrato é a funcao DEPOSITAR
  // entao nao faz sentido criar o contrato e ja enviar o ETH para ele
  const escrow = m.contract("Escrow", [enderecoContratante, enderecoPrestador, valorDoProjeto]);

  return { escrow };
});