import { network } from "hardhat";

async function main() {
  console.log("Iniciando o deploy da EscrowFactory...");

  const { viem } = await network.connect();

  const factory = await viem.deployContract("EscrowFactory");

  console.log(`\nEscrowFactory publicada com sucesso!`);
  console.log(`Endereço do contrato: ${factory.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});