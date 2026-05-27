import { describe, it } from "node:test";
import assert from "node:assert/strict";
import hre from "hardhat";
import { parseEther, type Address } from "viem";

const Estado = {
  CRIADO: 0,
  ACEITO: 1,
  DEPOSITADO: 2,
  ENTREGUE: 3,
  FINALIZADO: 4,
  EM_DISPUTA: 5,
} as const;

async function deployFactory() {
  const { viem, networkHelpers } = await hre.network.create();
  const [contratante, prestador, arbitro, terceiro] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();
  const factory = await viem.deployContract("EscrowFactory");

  return { viem, networkHelpers, publicClient, contratante, prestador, arbitro, terceiro, factory };
}

async function deployFactoryComEscrow() {
  const base = await deployFactory();
  const { viem, factory, contratante, prestador, arbitro } = base;
  const valor = parseEther("1");

  await factory.write.criaEscrow(
    [prestador.account!.address, arbitro.account!.address, valor],
    { account: contratante.account }
  );

  const todosOsEscrows = await factory.read.exibirTodosEscrow();
  const escrowAddress = todosOsEscrows[0] as Address;
  const escrow = await viem.getContractAt("Escrow", escrowAddress);

  return { ...base, escrow, escrowAddress, valor };
}

// Fixture que avança até o estado DEPOSITADO
async function escrowDepositado() {
  const base = await deployFactoryComEscrow();
  const { escrow, contratante, prestador, valor } = base;
  await escrow.write.aceitarContrato({ account: prestador.account });
  await escrow.write.depositar({ account: contratante.account, value: valor });
  return base;
}

// Fixture que avança até o estado ENTREGUE
async function escrowEntregue() {
  const base = await escrowDepositado();
  const { escrow, prestador } = base;
  await escrow.write.entregarServico({ account: prestador.account });
  return base;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Suite principal
// ═══════════════════════════════════════════════════════════════════════════════

describe("EscrowFactory + Escrow", () => {

  // ───────────────────────────────────────────────────────────────────────────
  // EscrowFactory
  // ───────────────────────────────────────────────────────────────────────────

  describe("EscrowFactory", () => {
    it("deve iniciar sem nenhum escrow", async () => {
      const { factory } = await deployFactory();
      const todos = await factory.read.exibirTodosEscrow();
      assert.equal(todos.length, 0);
    });

    it("deve criar um escrow e registrá-lo globalmente", async () => {
      const { factory, contratante, prestador, arbitro } = await deployFactory();
      await factory.write.criaEscrow(
        [prestador.account!.address, arbitro.account!.address, parseEther("1")],
        { account: contratante.account }
      );
      const todos = await factory.read.exibirTodosEscrow();
      assert.equal(todos.length, 1);
    });

    it("deve registrar o escrow para contratante e prestador", async () => {
      const { factory, contratante, prestador, arbitro } = await deployFactory();
      await factory.write.criaEscrow(
        [prestador.account!.address, arbitro.account!.address, parseEther("1")],
        { account: contratante.account }
      );

      const escrowsContratante =
        await factory.read.exibirEscrowUsuarioEspecifico([contratante.account!.address]);
      const escrowsPrestador =
        await factory.read.exibirEscrowUsuarioEspecifico([prestador.account!.address]);

      assert.equal(escrowsContratante.length, 1);
      assert.equal(escrowsPrestador.length, 1);
      assert.equal(
        escrowsContratante[0].toLowerCase(),
        escrowsPrestador[0].toLowerCase()
      );
    });

    it("deve criar múltiplos escrows corretamente", async () => {
      const { factory, contratante, prestador, arbitro } = await deployFactory();
      for (let i = 0; i < 2; i++) {
        await factory.write.criaEscrow(
          [prestador.account!.address, arbitro.account!.address, parseEther("0.5")],
          { account: contratante.account }
        );
      }
      const todos = await factory.read.exibirTodosEscrow();
      assert.equal(todos.length, 2);
    });

    it("deve retornar lista vazia para usuário sem escrows", async () => {
      const { factory, terceiro } = await deployFactory();
      const escrows =
        await factory.read.exibirEscrowUsuarioEspecifico([terceiro.account!.address]);
      assert.equal(escrows.length, 0);
    });

    // ── Validações de segurança ──────────────────────────────────────────────

    it("deve rejeitar prestador com endereço zero", async () => {
      const { factory, contratante, arbitro } = await deployFactory();
      await assert.rejects(
        factory.write.criaEscrow(
          ["0x0000000000000000000000000000000000000000", arbitro.account!.address, parseEther("1")],
          { account: contratante.account }
        ),
        /Endereco do prestador invalido/
      );
    });

    it("deve rejeitar arbitro com endereço zero", async () => {
      const { factory, contratante, prestador } = await deployFactory();
      await assert.rejects(
        factory.write.criaEscrow(
          [prestador.account!.address, "0x0000000000000000000000000000000000000000", parseEther("1")],
          { account: contratante.account }
        ),
        /Endereco do arbitro invalido/
      );
    });

    it("deve rejeitar quando contratante e prestador são o mesmo", async () => {
      const { factory, contratante, arbitro } = await deployFactory();
      await assert.rejects(
        factory.write.criaEscrow(
          [contratante.account!.address, arbitro.account!.address, parseEther("1")],
          { account: contratante.account }
        ),
        /Contratante e prestador nao podem ser o mesmo/
      );
    });

    it("deve rejeitar quando arbitro é o contratante", async () => {
      const { factory, contratante, prestador } = await deployFactory();
      await assert.rejects(
        factory.write.criaEscrow(
          [prestador.account!.address, contratante.account!.address, parseEther("1")],
          { account: contratante.account }
        ),
        /Arbitro deve ser um terceiro neutro/
      );
    });

    it("deve rejeitar quando arbitro é o prestador", async () => {
      const { factory, contratante, prestador } = await deployFactory();
      await assert.rejects(
        factory.write.criaEscrow(
          [prestador.account!.address, prestador.account!.address, parseEther("1")],
          { account: contratante.account }
        ),
        /Arbitro deve ser um terceiro neutro/
      );
    });

    it("deve rejeitar valor zero", async () => {
      const { factory, contratante, prestador, arbitro } = await deployFactory();
      await assert.rejects(
        factory.write.criaEscrow(
          [prestador.account!.address, arbitro.account!.address, 0n],
          { account: contratante.account }
        ),
        /O valor do servico deve ser maior que zero/
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Escrow — estado inicial
  // ───────────────────────────────────────────────────────────────────────────

  describe("Escrow — deploy e estado inicial", () => {
    it("deve configurar contratante, prestador, arbitro e valor corretamente", async () => {
      const { escrow, contratante, prestador, arbitro, valor } = await deployFactoryComEscrow();

      assert.equal(
        (await escrow.read.contratante() as string).toLowerCase(),
        contratante.account!.address.toLowerCase()
      );
      assert.equal(
        (await escrow.read.prestador() as string).toLowerCase(),
        prestador.account!.address.toLowerCase()
      );
      assert.equal(
        (await escrow.read.arbitro() as string).toLowerCase(),
        arbitro.account!.address.toLowerCase()
      );
      assert.equal(await escrow.read.valor(), valor);
      assert.equal(await escrow.read.estado(), Estado.CRIADO);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Escrow — aceitarContrato()
  // ───────────────────────────────────────────────────────────────────────────

  describe("Escrow — aceitarContrato()", () => {
    it("deve permitir que o prestador aceite o contrato", async () => {
      const { escrow, prestador } = await deployFactoryComEscrow();
      await escrow.write.aceitarContrato({ account: prestador.account });
      assert.equal(await escrow.read.estado(), Estado.ACEITO);
    });

    it("deve rejeitar aceite feito pelo contratante", async () => {
      const { escrow, contratante } = await deployFactoryComEscrow();
      await assert.rejects(
        escrow.write.aceitarContrato({ account: contratante.account }),
        /Somente o prestador pode chamar essa funcao/
      );
    });

    it("deve rejeitar aceite feito por terceiros", async () => {
      const { escrow, terceiro } = await deployFactoryComEscrow();
      await assert.rejects(
        escrow.write.aceitarContrato({ account: terceiro.account }),
        /Somente o prestador pode chamar essa funcao/
      );
    });

    it("deve rejeitar segundo aceite após o primeiro", async () => {
      const { escrow, prestador } = await deployFactoryComEscrow();
      await escrow.write.aceitarContrato({ account: prestador.account });
      await assert.rejects(
        escrow.write.aceitarContrato({ account: prestador.account }),
        /Contrato ainda nao criado/
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Escrow — depositar()
  // ───────────────────────────────────────────────────────────────────────────

  describe("Escrow — depositar()", () => {
    it("deve permitir que o contratante deposite após aceite", async () => {
      const { escrow, contratante, prestador, valor } = await deployFactoryComEscrow();
      await escrow.write.aceitarContrato({ account: prestador.account });
      await escrow.write.depositar({ account: contratante.account, value: valor });
      assert.equal(await escrow.read.estado(), Estado.DEPOSITADO);
    });

    it("deve rejeitar depósito sem aceite prévio", async () => {
      const { escrow, contratante, valor } = await deployFactoryComEscrow();
      await assert.rejects(
        escrow.write.depositar({ account: contratante.account, value: valor }),
        /O prestador precisa aceitar o contrato primeiro/
      );
    });

    it("deve rejeitar depósito feito por terceiros", async () => {
      const { escrow, prestador, terceiro, valor } = await deployFactoryComEscrow();
      await escrow.write.aceitarContrato({ account: prestador.account });
      await assert.rejects(
        escrow.write.depositar({ account: terceiro.account, value: valor }),
        /Somente o contratante pode chamar essa funcao/
      );
    });

    it("deve rejeitar depósito com valor insuficiente", async () => {
      const { escrow, contratante, prestador } = await deployFactoryComEscrow();
      await escrow.write.aceitarContrato({ account: prestador.account });
      await assert.rejects(
        escrow.write.depositar({ account: contratante.account, value: parseEther("0.5") }),
        /Dinheiro Insuficiente/
      );
    });

    it("deve rejeitar depósito com valor em excesso", async () => {
      const { escrow, contratante, prestador } = await deployFactoryComEscrow();
      await escrow.write.aceitarContrato({ account: prestador.account });
      await assert.rejects(
        escrow.write.depositar({ account: contratante.account, value: parseEther("2") }),
        /Dinheiro Insuficiente/
      );
    });

    it("deve rejeitar segundo depósito após o primeiro", async () => {
      const { escrow, contratante, prestador, valor } = await deployFactoryComEscrow();
      await escrow.write.aceitarContrato({ account: prestador.account });
      await escrow.write.depositar({ account: contratante.account, value: valor });
      await assert.rejects(
        escrow.write.depositar({ account: contratante.account, value: valor }),
        /O prestador precisa aceitar o contrato primeiro/
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Escrow — entregarServico()
  // ───────────────────────────────────────────────────────────────────────────

  describe("Escrow — entregarServico()", () => {
    it("deve permitir que o prestador entregue após depósito", async () => {
      const { escrow, prestador } = await escrowDepositado();
      await escrow.write.entregarServico({ account: prestador.account });
      assert.equal(await escrow.read.estado(), Estado.ENTREGUE);
    });

    it("deve rejeitar entrega sem depósito prévio", async () => {
      const { escrow, prestador } = await deployFactoryComEscrow();
      await assert.rejects(
        escrow.write.entregarServico({ account: prestador.account }),
        /Dinheiro ainda nao estar depositado/
      );
    });

    it("deve rejeitar entrega feita pelo contratante", async () => {
      const { escrow, contratante } = await escrowDepositado();
      await assert.rejects(
        escrow.write.entregarServico({ account: contratante.account }),
        /Somente o prestador pode chamar essa funcao/
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Escrow — pagarPrestador()
  // ───────────────────────────────────────────────────────────────────────────

  describe("Escrow — pagarPrestador()", () => {
    it("deve transferir o saldo para o prestador ao aprovar", async () => {
      const { escrow, publicClient, contratante, prestador } = await escrowEntregue();

      const saldoAntes = await publicClient.getBalance({ address: prestador.account!.address });
      await escrow.write.pagarPrestador({ account: contratante.account });
      const saldoDepois = await publicClient.getBalance({ address: prestador.account!.address });

      assert.ok(saldoDepois > saldoAntes, "Saldo do prestador deve aumentar");
      assert.equal(await escrow.read.estado(), Estado.FINALIZADO);
    });

    it("deve zerar o saldo do contrato após o pagamento", async () => {
      const { escrow, publicClient, contratante } = await escrowEntregue();
      await escrow.write.pagarPrestador({ account: contratante.account });
      assert.equal(await publicClient.getBalance({ address: escrow.address }), 0n);
    });

    it("deve rejeitar pagamento sem entrega prévia", async () => {
      const { escrow, contratante } = await escrowDepositado();
      await assert.rejects(
        escrow.write.pagarPrestador({ account: contratante.account }),
        /Projeto ainda nao foi entregue/
      );
    });

    it("deve rejeitar pagamento feito pelo prestador", async () => {
      const { escrow, prestador } = await escrowEntregue();
      await assert.rejects(
        escrow.write.pagarPrestador({ account: prestador.account }),
        /Somente o contratante pode chamar essa funcao/
      );
    });

    it("deve rejeitar pagamento duplicado após FINALIZADO", async () => {
      const { escrow, contratante } = await escrowEntregue();
      await escrow.write.pagarPrestador({ account: contratante.account });
      await assert.rejects(
        escrow.write.pagarPrestador({ account: contratante.account }),
        /Projeto ainda nao foi entregue/
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Escrow — pagarPorPrazoExpirado()
  // ───────────────────────────────────────────────────────────────────────────

  describe("Escrow — pagarPorPrazoExpirado()", () => {
    it("deve permitir saque pelo prestador após 3 dias sem aprovação", async () => {
      const { escrow, publicClient, prestador, networkHelpers } = await escrowEntregue();

      await networkHelpers.time.increase(3 * 24 * 60 * 60 + 1);

      const saldoAntes = await publicClient.getBalance({ address: prestador.account!.address });
      await escrow.write.pagarPorPrazoExpirado({ account: prestador.account });
      const saldoDepois = await publicClient.getBalance({ address: prestador.account!.address });

      assert.ok(saldoDepois > saldoAntes, "Saldo do prestador deve aumentar");
      assert.equal(await escrow.read.estado(), Estado.FINALIZADO);
    });

    it("deve rejeitar saque antes de 3 dias", async () => {
      const { escrow, prestador, networkHelpers } = await escrowEntregue();
      await networkHelpers.time.increase(24 * 60 * 60);
      await assert.rejects(
        escrow.write.pagarPorPrazoExpirado({ account: prestador.account }),
        /Prazo de 3 dias nao expirou/
      );
    });

    it("deve rejeitar saque se serviço não foi entregue", async () => {
      const { escrow, prestador, networkHelpers } = await escrowDepositado();
      await networkHelpers.time.increase(3 * 24 * 60 * 60 + 1);
      await assert.rejects(
        escrow.write.pagarPorPrazoExpirado({ account: prestador.account }),
        /Projeto ainda nao foi entregue/
      );
    });

    it("deve rejeitar saque por terceiros mesmo após 3 dias", async () => {
      const { escrow, terceiro, networkHelpers } = await escrowEntregue();
      await networkHelpers.time.increase(3 * 24 * 60 * 60 + 1);
      await assert.rejects(
        escrow.write.pagarPorPrazoExpirado({ account: terceiro.account }),
        /Somente o prestador pode chamar essa funcao/
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Escrow — reembolsar()
  // ───────────────────────────────────────────────────────────────────────────

  describe("Escrow — reembolsar()", () => {
    it("deve permitir reembolso ao contratante após 30 dias sem entrega", async () => {
      const { escrow, publicClient, contratante, networkHelpers } = await escrowDepositado();

      await networkHelpers.time.increase(30 * 24 * 60 * 60 + 1);

      const saldoAntes = await publicClient.getBalance({ address: contratante.account!.address });
      await escrow.write.reembolsar({ account: contratante.account });
      const saldoDepois = await publicClient.getBalance({ address: contratante.account!.address });

      assert.ok(saldoDepois > saldoAntes, "Saldo do contratante deve aumentar");
      assert.equal(await escrow.read.estado(), Estado.FINALIZADO);
      assert.equal(await publicClient.getBalance({ address: escrow.address }), 0n);
    });

    it("deve rejeitar reembolso antes de 30 dias", async () => {
      const { escrow, contratante, networkHelpers } = await escrowDepositado();
      await networkHelpers.time.increase(15 * 24 * 60 * 60);
      await assert.rejects(
        escrow.write.reembolsar({ account: contratante.account }),
        /Aguarde 30 dias para poder reembolsar/
      );
    });

    it("deve rejeitar reembolso se estado não for DEPOSITADO", async () => {
      const { escrow, contratante } = await deployFactoryComEscrow();
      await assert.rejects(
        escrow.write.reembolsar({ account: contratante.account }),
        /Nao tem deposito para reembolsar/
      );
    });

    it("deve rejeitar reembolso feito pelo prestador", async () => {
      const { escrow, prestador, networkHelpers } = await escrowDepositado();
      await networkHelpers.time.increase(30 * 24 * 60 * 60 + 1);
      await assert.rejects(
        escrow.write.reembolsar({ account: prestador.account }),
        /Somente o contratante pode chamar essa funcao/
      );
    });

    it("deve rejeitar reembolso após serviço já entregue", async () => {
      const { escrow, contratante, networkHelpers } = await escrowEntregue();
      await networkHelpers.time.increase(30 * 24 * 60 * 60 + 1);
      await assert.rejects(
        escrow.write.reembolsar({ account: contratante.account }),
        /Nao tem deposito para reembolsar/
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Escrow — iniciarDisputa()
  // ───────────────────────────────────────────────────────────────────────────

  describe("Escrow — iniciarDisputa()", () => {
    it("deve permitir que o contratante inicie disputa após depósito", async () => {
      const { escrow, contratante } = await escrowDepositado();
      await escrow.write.iniciarDisputa({ account: contratante.account });
      assert.equal(await escrow.read.estado(), Estado.EM_DISPUTA);
    });

    it("deve permitir que o prestador inicie disputa após depósito", async () => {
      const { escrow, prestador } = await escrowDepositado();
      await escrow.write.iniciarDisputa({ account: prestador.account });
      assert.equal(await escrow.read.estado(), Estado.EM_DISPUTA);
    });

    it("deve permitir disputa quando serviço já foi entregue", async () => {
      const { escrow, contratante } = await escrowEntregue();
      await escrow.write.iniciarDisputa({ account: contratante.account });
      assert.equal(await escrow.read.estado(), Estado.EM_DISPUTA);
    });

    it("deve rejeitar disputa por terceiros", async () => {
      const { escrow, terceiro } = await escrowDepositado();
      await assert.rejects(
        escrow.write.iniciarDisputa({ account: terceiro.account }),
        /Somente partes envolvidas podem abrir disputa/
      );
    });

    it("deve rejeitar disputa se dinheiro não foi depositado", async () => {
      const { escrow, contratante } = await deployFactoryComEscrow();
      await assert.rejects(
        escrow.write.iniciarDisputa({ account: contratante.account }),
        /Estado invalido para disputa/
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Escrow — resolverDisputa()
  // ───────────────────────────────────────────────────────────────────────────

  describe("Escrow — resolverDisputa()", () => {
    it("deve pagar o prestador quando árbitro decide a favor dele", async () => {
      const { escrow, publicClient, contratante, prestador, arbitro } = await escrowDepositado();
      await escrow.write.iniciarDisputa({ account: contratante.account });

      const saldoAntes = await publicClient.getBalance({ address: prestador.account!.address });
      await escrow.write.resolverDisputa([true], { account: arbitro.account });
      const saldoDepois = await publicClient.getBalance({ address: prestador.account!.address });

      assert.ok(saldoDepois > saldoAntes, "Saldo do prestador deve aumentar");
      assert.equal(await escrow.read.estado(), Estado.FINALIZADO);
      assert.equal(await publicClient.getBalance({ address: escrow.address }), 0n);
    });

    it("deve reembolsar o contratante quando árbitro decide a favor dele", async () => {
      const { escrow, publicClient, contratante, arbitro } = await escrowDepositado();
      await escrow.write.iniciarDisputa({ account: contratante.account });

      const saldoAntes = await publicClient.getBalance({ address: contratante.account!.address });
      await escrow.write.resolverDisputa([false], { account: arbitro.account });
      const saldoDepois = await publicClient.getBalance({ address: contratante.account!.address });

      assert.ok(saldoDepois > saldoAntes, "Saldo do contratante deve aumentar");
      assert.equal(await escrow.read.estado(), Estado.FINALIZADO);
      assert.equal(await publicClient.getBalance({ address: escrow.address }), 0n);
    });

    it("deve rejeitar resolução por terceiros", async () => {
      const { escrow, contratante, terceiro } = await escrowDepositado();
      await escrow.write.iniciarDisputa({ account: contratante.account });
      await assert.rejects(
        escrow.write.resolverDisputa([true], { account: terceiro.account }),
        /Somente o arbitro pode resolver/
      );
    });

    it("deve rejeitar resolução sem disputa aberta", async () => {
      const { escrow, arbitro } = await escrowDepositado();
      await assert.rejects(
        escrow.write.resolverDisputa([true], { account: arbitro.account }),
        /Contrato nao esta em disputa/
      );
    });

    it("deve rejeitar segunda resolução após FINALIZADO", async () => {
      const { escrow, contratante, arbitro } = await escrowDepositado();
      await escrow.write.iniciarDisputa({ account: contratante.account });
      await escrow.write.resolverDisputa([true], { account: arbitro.account });
      await assert.rejects(
        escrow.write.resolverDisputa([false], { account: arbitro.account }),
        /Contrato nao esta em disputa/
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Escrow — eventos
  // ───────────────────────────────────────────────────────────────────────────

  describe("Escrow — eventos", () => {
    it("deve emitir EscrowCriado ao criar escrow", async () => {
      const { factory, publicClient, contratante, prestador, arbitro } = await deployFactory();
      const hash = await factory.write.criaEscrow(
        [prestador.account!.address, arbitro.account!.address, parseEther("1")],
        { account: contratante.account }
      );
      const recibo = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(recibo.logs.length > 0, true);
    });

    it("deve emitir ContratoAceito ao aceitar", async () => {
      const { escrow, publicClient, prestador } = await deployFactoryComEscrow();
      const hash = await escrow.write.aceitarContrato({ account: prestador.account });
      const recibo = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(recibo.logs.length > 0, true);
    });

    it("deve emitir ServicoDepositado ao depositar", async () => {
      const { escrow, publicClient, contratante, valor } = await escrowDepositado();
      const hash = await publicClient.getTransactionReceipt({
        hash: (await publicClient.getBlock({ blockTag: "latest" })).transactions[0]
      });
      assert.equal(hash.logs.length > 0, true);
    });

    it("deve emitir DisputaIniciada ao iniciar disputa", async () => {
      const { escrow, publicClient, contratante } = await escrowDepositado();
      const hash = await escrow.write.iniciarDisputa({ account: contratante.account });
      const recibo = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(recibo.logs.length > 0, true);
    });

    it("deve emitir DisputaResolvida ao resolver disputa", async () => {
      const { escrow, publicClient, contratante, arbitro } = await escrowDepositado();
      await escrow.write.iniciarDisputa({ account: contratante.account });
      const hash = await escrow.write.resolverDisputa([true], { account: arbitro.account });
      const recibo = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(recibo.logs.length > 0, true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Fluxo completo (happy paths)
  // ───────────────────────────────────────────────────────────────────────────

  describe("Fluxo completo", () => {
    it("ciclo normal: criar → aceitar → depositar → entregar → pagar", async () => {
      const { escrow, publicClient, contratante, prestador, valor } =
        await deployFactoryComEscrow();

      assert.equal(await escrow.read.estado(), Estado.CRIADO);

      await escrow.write.aceitarContrato({ account: prestador.account });
      assert.equal(await escrow.read.estado(), Estado.ACEITO);

      await escrow.write.depositar({ account: contratante.account, value: valor });
      assert.equal(await escrow.read.estado(), Estado.DEPOSITADO);
      assert.equal(await publicClient.getBalance({ address: escrow.address }), valor);

      await escrow.write.entregarServico({ account: prestador.account });
      assert.equal(await escrow.read.estado(), Estado.ENTREGUE);

      await escrow.write.pagarPrestador({ account: contratante.account });
      assert.equal(await escrow.read.estado(), Estado.FINALIZADO);
      assert.equal(await publicClient.getBalance({ address: escrow.address }), 0n);
    });

    it("ciclo com prazo expirado: criar → aceitar → depositar → entregar → prazo → saque", async () => {
      const { escrow, publicClient, networkHelpers } = await escrowEntregue();

      await networkHelpers.time.increase(3 * 24 * 60 * 60 + 1);
      const { prestador } = await escrowEntregue();
      await escrow.write.pagarPorPrazoExpirado({ account: prestador.account });

      assert.equal(await escrow.read.estado(), Estado.FINALIZADO);
      assert.equal(await publicClient.getBalance({ address: escrow.address }), 0n);
    });

    it("ciclo com reembolso: criar → aceitar → depositar → 30 dias → reembolso", async () => {
      const { escrow, publicClient, contratante, networkHelpers } = await escrowDepositado();

      await networkHelpers.time.increase(30 * 24 * 60 * 60 + 1);
      await escrow.write.reembolsar({ account: contratante.account });

      assert.equal(await escrow.read.estado(), Estado.FINALIZADO);
      assert.equal(await publicClient.getBalance({ address: escrow.address }), 0n);
    });

    it("ciclo com disputa — prestador vence", async () => {
      const { escrow, publicClient, contratante, arbitro } = await escrowDepositado();

      await escrow.write.iniciarDisputa({ account: contratante.account });
      assert.equal(await escrow.read.estado(), Estado.EM_DISPUTA);

      await escrow.write.resolverDisputa([true], { account: arbitro.account });
      assert.equal(await escrow.read.estado(), Estado.FINALIZADO);
      assert.equal(await publicClient.getBalance({ address: escrow.address }), 0n);
    });

    it("ciclo com disputa — contratante vence", async () => {
      const { escrow, publicClient, contratante, arbitro } = await escrowEntregue();

      await escrow.write.iniciarDisputa({ account: contratante.account });
      await escrow.write.resolverDisputa([false], { account: arbitro.account });

      assert.equal(await escrow.read.estado(), Estado.FINALIZADO);
      assert.equal(await publicClient.getBalance({ address: escrow.address }), 0n);
    });
  });
});