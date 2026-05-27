import { describe, it } from "node:test";
import assert from "node:assert/strict";
import hre from "hardhat";
import { parseEther, type Address } from "viem";

function toBigInt(value: unknown): bigint {
  return BigInt(value as string);
}

const Estado = {
  CRIADO: 0,
  ACEITO: 1,
  DEPOSITADO: 2,
  ENTREGUE: 3,
  FINALIZADO: 4,
  EM_DISPUTA: 5,
} as const;

const VALOR = parseEther("1");

async function deployFactory() {
  const { viem, networkHelpers } = await hre.network.create();
  const [contratante, prestador, arbitro, terceiro] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  const factory = await viem.deployContract("EscrowFactory");

  // Deploy do token ERC20 falso para testes — mintamos direto para o contratante
  const token = await viem.deployContract("MockERC20", [
    "Mock Token",
    "MTK",
    contratante.account!.address,
    parseEther("1000"), // saldo inicial do contratante
  ]);

  return { viem, networkHelpers, publicClient, contratante, prestador, arbitro, terceiro, factory, token };
}

async function deployFactoryComEscrow() {
  const base = await deployFactory();
  const { viem, factory, contratante, prestador, arbitro, token } = base;

  await factory.write.criaEscrow(
    [prestador.account!.address, arbitro.account!.address, token.address, VALOR],
    { account: contratante.account }
  );

  const todosOsEscrows = await factory.read.exibirTodosEscrow();
  const escrowAddress = todosOsEscrows[0] as Address;
  const escrow = await viem.getContractAt("Escrow", escrowAddress);

  return { ...base, escrow, escrowAddress };
}

// Avança até DEPOSITADO — faz approve + depositar
async function escrowDepositado() {
  const base = await deployFactoryComEscrow();
  const { escrow, contratante, prestador, token } = base;

  await escrow.write.aceitarContrato({ account: prestador.account });

  // Contratante precisa aprovar o contrato Escrow a gastar seus tokens antes de depositar
  await token.write.approve([escrow.address, VALOR], { account: contratante.account });
  await escrow.write.depositar({ account: contratante.account });

  return base;
}

// Avança até ENTREGUE
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
      const { factory, contratante, prestador, arbitro, token } = await deployFactory();
      await factory.write.criaEscrow(
        [prestador.account!.address, arbitro.account!.address, token.address, VALOR],
        { account: contratante.account }
      );
      const todos = await factory.read.exibirTodosEscrow();
      assert.equal(todos.length, 1);
    });

    it("deve registrar o escrow para contratante e prestador", async () => {
      const { factory, contratante, prestador, arbitro, token } = await deployFactory();
      await factory.write.criaEscrow(
        [prestador.account!.address, arbitro.account!.address, token.address, VALOR],
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
      const { factory, contratante, prestador, arbitro, token } = await deployFactory();
      for (let i = 0; i < 2; i++) {
        await factory.write.criaEscrow(
          [prestador.account!.address, arbitro.account!.address, token.address, VALOR],
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
      const { factory, contratante, arbitro, token } = await deployFactory();
      await assert.rejects(
        factory.write.criaEscrow(
          ["0x0000000000000000000000000000000000000000", arbitro.account!.address, token.address, VALOR],
          { account: contratante.account }
        ),
        /Endereco do prestador invalido/
      );
    });

    it("deve rejeitar arbitro com endereço zero", async () => {
      const { factory, contratante, prestador, token } = await deployFactory();
      await assert.rejects(
        factory.write.criaEscrow(
          [prestador.account!.address, "0x0000000000000000000000000000000000000000", token.address, VALOR],
          { account: contratante.account }
        ),
        /Endereco do arbitro invalido/
      );
    });

    it("deve rejeitar token com endereço zero", async () => {
      const { factory, contratante, prestador, arbitro } = await deployFactory();
      await assert.rejects(
        factory.write.criaEscrow(
          [prestador.account!.address, arbitro.account!.address, "0x0000000000000000000000000000000000000000", VALOR],
          { account: contratante.account }
        ),
        /Endereco do token de pagamento invalido/
      );
    });

    it("deve rejeitar quando contratante e prestador são o mesmo", async () => {
      const { factory, contratante, arbitro, token } = await deployFactory();
      await assert.rejects(
        factory.write.criaEscrow(
          [contratante.account!.address, arbitro.account!.address, token.address, VALOR],
          { account: contratante.account }
        ),
        /Contratante e prestador nao podem ser o mesmo/
      );
    });

    it("deve rejeitar quando arbitro é o contratante", async () => {
      const { factory, contratante, prestador, token } = await deployFactory();
      await assert.rejects(
        factory.write.criaEscrow(
          [prestador.account!.address, contratante.account!.address, token.address, VALOR],
          { account: contratante.account }
        ),
        /Arbitro deve ser um terceiro neutro/
      );
    });

    it("deve rejeitar quando arbitro é o prestador", async () => {
      const { factory, contratante, prestador, token } = await deployFactory();
      await assert.rejects(
        factory.write.criaEscrow(
          [prestador.account!.address, prestador.account!.address, token.address, VALOR],
          { account: contratante.account }
        ),
        /Arbitro deve ser um terceiro neutro/
      );
    });

    it("deve rejeitar valor zero", async () => {
      const { factory, contratante, prestador, arbitro, token } = await deployFactory();
      await assert.rejects(
        factory.write.criaEscrow(
          [prestador.account!.address, arbitro.account!.address, token.address, 0n],
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
    it("deve configurar contratante, prestador, arbitro, token e valor corretamente", async () => {
      const { escrow, contratante, prestador, arbitro, token } = await deployFactoryComEscrow();

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
      assert.equal(
        (await escrow.read.tokenPagamento() as string).toLowerCase(),
        token.address.toLowerCase()
      );
      assert.equal(await escrow.read.valor(), VALOR);
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
    it("deve permitir depósito após aceite com approve correto", async () => {
      const { escrow, contratante, prestador, token } = await deployFactoryComEscrow();
      await escrow.write.aceitarContrato({ account: prestador.account });
      await token.write.approve([escrow.address, VALOR], { account: contratante.account });
      await escrow.write.depositar({ account: contratante.account });
      assert.equal(await escrow.read.estado(), Estado.DEPOSITADO);
    });

    it("deve transferir os tokens do contratante para o escrow", async () => {
      const { escrow, contratante, prestador, token } = await deployFactoryComEscrow();
      await escrow.write.aceitarContrato({ account: prestador.account });
      await token.write.approve([escrow.address, VALOR], { account: contratante.account });

      const saldoAntes = toBigInt(await token.read.balanceOf([contratante.account!.address]));
      await escrow.write.depositar({ account: contratante.account });
      const saldoDepois = toBigInt(await token.read.balanceOf([contratante.account!.address]));

      assert.equal(saldoAntes - saldoDepois, VALOR);
      assert.equal(await token.read.balanceOf([escrow.address]), VALOR);
    });

    it("deve rejeitar depósito sem aceite prévio", async () => {
      const { escrow, contratante, token } = await deployFactoryComEscrow();
      await token.write.approve([escrow.address, VALOR], { account: contratante.account });
      await assert.rejects(
        escrow.write.depositar({ account: contratante.account }),
        /O prestador precisa aceitar o contrato primeiro/
      );
    });

    it("deve rejeitar depósito sem approve", async () => {
      const { escrow, contratante, prestador } = await deployFactoryComEscrow();
      await escrow.write.aceitarContrato({ account: prestador.account });
      await assert.rejects(
        escrow.write.depositar({ account: contratante.account }),
        /ERC20InsufficientAllowance/
      );
    });

    it("deve rejeitar depósito feito por terceiros", async () => {
      const { escrow, prestador, terceiro, token } = await deployFactoryComEscrow();
      await escrow.write.aceitarContrato({ account: prestador.account });
      await token.write.approve([escrow.address, VALOR], { account: terceiro.account });
      await assert.rejects(
        escrow.write.depositar({ account: terceiro.account }),
        /Somente o contratante pode chamar essa funcao/
      );
    });

    it("deve rejeitar segundo depósito após o primeiro", async () => {
      const { escrow, contratante, token } = await escrowDepositado();
      await token.write.approve([escrow.address, VALOR], { account: contratante.account });
      await assert.rejects(
        escrow.write.depositar({ account: contratante.account }),
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
    it("deve transferir tokens para o prestador ao aprovar", async () => {
      const { escrow, contratante, prestador, token } = await escrowEntregue();

      const saldoAntes = toBigInt(await token.read.balanceOf([prestador.account!.address]));
      await escrow.write.pagarPrestador({ account: contratante.account });
      const saldoDepois = toBigInt(await token.read.balanceOf([prestador.account!.address]));

      assert.equal(saldoDepois - saldoAntes, VALOR);
      assert.equal(await escrow.read.estado(), Estado.FINALIZADO);
    });

    it("deve zerar o saldo de tokens do escrow após pagamento", async () => {
      const { escrow, contratante, token } = await escrowEntregue();
      await escrow.write.pagarPrestador({ account: contratante.account });
      assert.equal(await token.read.balanceOf([escrow.address]), 0n);
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
      const { escrow, prestador, token, networkHelpers } = await escrowEntregue();

      await networkHelpers.time.increase(3 * 24 * 60 * 60 + 1);

      const saldoAntes = toBigInt(await token.read.balanceOf([prestador.account!.address]));
      await escrow.write.pagarPorPrazoExpirado({ account: prestador.account });
      const saldoDepois = toBigInt(await token.read.balanceOf([prestador.account!.address]));

      assert.equal(saldoDepois - saldoAntes, VALOR);
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
    it("deve reembolsar tokens ao contratante após 30 dias sem entrega", async () => {
      const { escrow, contratante, token, networkHelpers } = await escrowDepositado();

      await networkHelpers.time.increase(30 * 24 * 60 * 60 + 1);

      const saldoAntes = toBigInt(await token.read.balanceOf([contratante.account!.address]));
      await escrow.write.reembolsar({ account: contratante.account });
      const saldoDepois = toBigInt(await token.read.balanceOf([contratante.account!.address]));

      assert.equal(saldoDepois - saldoAntes, VALOR);
      assert.equal(await escrow.read.estado(), Estado.FINALIZADO);
      assert.equal(await token.read.balanceOf([escrow.address]), 0n);
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
    it("deve transferir tokens ao prestador quando árbitro decide a favor dele", async () => {
      const { escrow, contratante, prestador, arbitro, token } = await escrowDepositado();
      await escrow.write.iniciarDisputa({ account: contratante.account });

      const saldoAntes = toBigInt(await token.read.balanceOf([prestador.account!.address]));
      await escrow.write.resolverDisputa([true], { account: arbitro.account });
      const saldoDepois = toBigInt(await token.read.balanceOf([prestador.account!.address]));

      assert.equal(saldoDepois - saldoAntes, VALOR);
      assert.equal(await escrow.read.estado(), Estado.FINALIZADO);
      assert.equal(await token.read.balanceOf([escrow.address]), 0n);
    });

    it("deve reembolsar tokens ao contratante quando árbitro decide a favor dele", async () => {
      const { escrow, contratante, arbitro, token } = await escrowDepositado();
      await escrow.write.iniciarDisputa({ account: contratante.account });

      const saldoAntes = toBigInt(await token.read.balanceOf([contratante.account!.address]));
      await escrow.write.resolverDisputa([false], { account: arbitro.account });
      const saldoDepois = toBigInt(await token.read.balanceOf([contratante.account!.address]));

      assert.equal(saldoDepois - saldoAntes, VALOR);
      assert.equal(await escrow.read.estado(), Estado.FINALIZADO);
      assert.equal(await token.read.balanceOf([escrow.address]), 0n);
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
      const { factory, publicClient, contratante, prestador, arbitro, token } = await deployFactory();
      const hash = await factory.write.criaEscrow(
        [prestador.account!.address, arbitro.account!.address, token.address, VALOR],
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
      const { escrow, publicClient } = await escrowDepositado();
      const block = await publicClient.getBlock({ blockTag: "latest" });
      const recibo = await publicClient.getTransactionReceipt({ hash: block.transactions[0] });
      assert.equal(recibo.logs.length > 0, true);
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
      const { escrow, contratante, prestador, token } = await deployFactoryComEscrow();

      assert.equal(await escrow.read.estado(), Estado.CRIADO);

      await escrow.write.aceitarContrato({ account: prestador.account });
      assert.equal(await escrow.read.estado(), Estado.ACEITO);

      await token.write.approve([escrow.address, VALOR], { account: contratante.account });
      await escrow.write.depositar({ account: contratante.account });
      assert.equal(await escrow.read.estado(), Estado.DEPOSITADO);
      assert.equal(await token.read.balanceOf([escrow.address]), VALOR);

      await escrow.write.entregarServico({ account: prestador.account });
      assert.equal(await escrow.read.estado(), Estado.ENTREGUE);

      await escrow.write.pagarPrestador({ account: contratante.account });
      assert.equal(await escrow.read.estado(), Estado.FINALIZADO);
      assert.equal(await token.read.balanceOf([escrow.address]), 0n);
    });

    it("ciclo com prazo expirado: criar → aceitar → depositar → entregar → prazo → saque", async () => {
      const { escrow, prestador, token, networkHelpers } = await escrowEntregue();

      await networkHelpers.time.increase(3 * 24 * 60 * 60 + 1);
      await escrow.write.pagarPorPrazoExpirado({ account: prestador.account });

      assert.equal(await escrow.read.estado(), Estado.FINALIZADO);
      assert.equal(await token.read.balanceOf([escrow.address]), 0n);
    });

    it("ciclo com reembolso: criar → aceitar → depositar → 30 dias → reembolso", async () => {
      const { escrow, contratante, token, networkHelpers } = await escrowDepositado();

      await networkHelpers.time.increase(30 * 24 * 60 * 60 + 1);
      await escrow.write.reembolsar({ account: contratante.account });

      assert.equal(await escrow.read.estado(), Estado.FINALIZADO);
      assert.equal(await token.read.balanceOf([escrow.address]), 0n);
    });

    it("ciclo com disputa — prestador vence", async () => {
      const { escrow, contratante, arbitro, token } = await escrowDepositado();

      await escrow.write.iniciarDisputa({ account: contratante.account });
      assert.equal(await escrow.read.estado(), Estado.EM_DISPUTA);

      await escrow.write.resolverDisputa([true], { account: arbitro.account });
      assert.equal(await escrow.read.estado(), Estado.FINALIZADO);
      assert.equal(await token.read.balanceOf([escrow.address]), 0n);
    });

    it("ciclo com disputa — contratante vence", async () => {
      const { escrow, contratante, arbitro, token } = await escrowEntregue();

      await escrow.write.iniciarDisputa({ account: contratante.account });
      await escrow.write.resolverDisputa([false], { account: arbitro.account });

      assert.equal(await escrow.read.estado(), Estado.FINALIZADO);
      assert.equal(await token.read.balanceOf([escrow.address]), 0n);
    });
  });
});