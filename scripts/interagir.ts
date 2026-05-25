import "@nomicfoundation/hardhat-toolbox-viem";
import { parseEther } from "viem";
import { network } from "hardhat";

/**
 * Script de Teste: Simula o fluxo completo de um Escrow
 *
 * Fluxo:
 *   1. Contratante cria o Escrow na Factory (sem ETH)
 *   2. Contratante deposita o ETH no contrato filho
 *   3. Prestador marca o serviço como entregue
 *   4. Contratante aprova e libera o pagamento
 */
async function main() {
  const enderecoFactory = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const valorDoServico = parseEther("0.1");

  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const walletClients = await viem.getWalletClients();

  const contratante = walletClients[0]; // Account #0
  const prestador   = walletClients[2]; // Account #2

  console.log("=".repeat(60));
  console.log("Contas:");
  console.log(`  Contratante : ${contratante.account.address}`);
  console.log(`  Prestador   : ${prestador.account.address}`);
  console.log(`  Valor       : 0.1 ETH`);
  console.log("=".repeat(60));

  // ─── PASSO 1: Criar o Escrow na Factory ───────────────────────
  console.log("\n[1/4] Criando o Escrow na Factory...");

  const factoryContract = await viem.getContractAt(
    "EscrowFactory",
    enderecoFactory,
    { client: { wallet: contratante } }
  );

  const hashCriacao = await factoryContract.write.criaEscrow(
    [prestador.account.address, valorDoServico]
  );

  const reciboCriacao = await publicClient.waitForTransactionReceipt({ hash: hashCriacao });
  console.log(`  Status : ${reciboCriacao.status}`);

  // Pega o endereço do contrato filho recém-criado
  const todosEscrows = await factoryContract.read.exibirTodosEscrow();
  const enderecoEscrow = todosEscrows[todosEscrows.length - 1] as `0x${string}`;
  console.log(`  Escrow criado em: ${enderecoEscrow}`);

  // ─── PASSO 2: Contratante deposita o ETH ──────────────────────
  console.log("\n[2/4] Contratante depositando 0.1 ETH no Escrow...");

  const escrowContratante = await viem.getContractAt(
    "Escrow",
    enderecoEscrow,
    { client: { wallet: contratante } }
  );

  const hashDeposito = await escrowContratante.write.depositar({
  value: valorDoServico
} as any);

  const reciboDeposito = await publicClient.waitForTransactionReceipt({ hash: hashDeposito });
  console.log(`  Status : ${reciboDeposito.status}`);

  // ─── PASSO 3: Prestador entrega o serviço ─────────────────────
  console.log("\n[3/4] Prestador marcando serviço como entregue...");

  const escrowPrestador = await viem.getContractAt(
    "Escrow",
    enderecoEscrow,
    { client: { wallet: prestador } }
  );

  const hashEntrega = await escrowPrestador.write.entregarServico();
  const reciboEntrega = await publicClient.waitForTransactionReceipt({ hash: hashEntrega });
  console.log(`  Status : ${reciboEntrega.status}`);

  // ─── PASSO 4: Contratante aprova e libera o pagamento ─────────
  console.log("\n[4/4] Contratante aprovando e liberando pagamento...");

  const hashPagamento = await escrowContratante.write.pagarPrestador();
  const reciboPagamento = await publicClient.waitForTransactionReceipt({ hash: hashPagamento });
  console.log(`  Status : ${reciboPagamento.status}`);

  console.log("\n" + "=".repeat(60));
  console.log("Fluxo completo executado com sucesso!");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });