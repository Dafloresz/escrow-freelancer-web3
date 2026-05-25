import { describe, it } from "node:test";
import assert from "node:assert/strict";
import hre from "hardhat";
import { parseEther, type Address } from "viem";

const Estado = {
  CRIADO: 0,
  DEPOSITADO: 1,
  ENTREGUE: 2,
  FINALIZADO: 3,
} as const;

async function deployFactory() {
  const { viem, networkHelpers } = await hre.network.create();
  const [contratante, prestador, terceiro] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();
  const factory = await viem.deployContract("EscrowFactory");

  return { viem, networkHelpers, publicClient, contratante, prestador, terceiro, factory };
}

async function deployFactoryComEscrow() {
  const base = await deployFactory();
  const { viem, factory, contratante, prestador } = base;
  const valor = parseEther("1");

  await factory.write.criaEscrow(
    [prestador.account!.address, valor],
    { account: contratante.account }
  );

  const todosOsEscrows = await factory.read.exibirTodosEscrow();
  const escrowAddress = todosOsEscrows[0] as Address;
  const escrow = await viem.getContractAt("Escrow", escrowAddress);

  return { ...base, escrow, escrowAddress, valor };
}

describe("EscrowFactory + Escrow", () => {

  describe("EscrowFactory", () => {
    it("deve iniciar sem nenhum escrow", async () => {
      const { factory } = await deployFactory();
      const todos = await factory.read.exibirTodosEscrow();
      assert.equal(todos.length, 0);
    });

    it("deve criar um escrow e registrá-lo globalmente", async () => {
      const { factory, contratante, prestador } = await deployFactory();
      await factory.write.criaEscrow(
        [prestador.account!.address, parseEther("1")],
        { account: contratante.account }
      );
      const todos = await factory.read.exibirTodosEscrow();
      assert.equal(todos.length, 1);
    });

    it("deve registrar o escrow para contratante e prestador", async () => {
      const { factory, contratante, prestador } = await deployFactory();
      await factory.write.criaEscrow(
        [prestador.account!.address, parseEther("1")],
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
      const { factory, contratante, prestador } = await deployFactory();
      for (let i = 0; i < 2; i++) {
        await factory.write.criaEscrow(
          [prestador.account!.address, parseEther("0.5")],
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

    it("deve rejeitar prestador com endereço zero", async () => {
      const { factory, contratante } = await deployFactory();
      await assert.rejects(
        factory.write.criaEscrow(
          ["0x0000000000000000000000000000000000000000", parseEther("1")],
          { account: contratante.account }
        ),
        /Endereco do prestador invalido/
      );
    });

    it("deve rejeitar quando contratante e prestador são o mesmo", async () => {
      const { factory, contratante } = await deployFactory();
      await assert.rejects(
        factory.write.criaEscrow(
          [contratante.account!.address, parseEther("1")],
          { account: contratante.account }
        ),
        /Contratante e prestador nao podem ser o mesmo/
      );
    });

    it("deve rejeitar valor zero", async () => {
      const { factory, contratante, prestador } = await deployFactory();
      await assert.rejects(
        factory.write.criaEscrow(
          [prestador.account!.address, 0n],
          { account: contratante.account }
        ),
        /O valor do servico deve ser maior que zero/
      );
    });
  });

  describe("Escrow — deploy e estado inicial", () => {
    it("deve configurar contratante, prestador e valor corretamente", async () => {
      const { escrow, contratante, prestador, valor } = await deployFactoryComEscrow();

      assert.equal(
        (await escrow.read.contratante() as string).toLowerCase(),
        contratante.account!.address.toLowerCase()
      );
      assert.equal(
        (await escrow.read.prestador() as string).toLowerCase(),
        prestador.account!.address.toLowerCase()
      );
      assert.equal(await escrow.read.valor(), valor);
      assert.equal(await escrow.read.estado(), Estado.CRIADO);
    });
  });

  describe("Escrow — depositar()", () => {
    it("deve permitir que o contratante deposite o valor exato", async () => {
      const { escrow, contratante, valor } = await deployFactoryComEscrow();
      await escrow.write.depositar({ account: contratante.account, value: valor });
      assert.equal(await escrow.read.estado(), Estado.DEPOSITADO);
    });

    it("deve rejeitar depósito feito por terceiros", async () => {
      const { escrow, terceiro, valor } = await deployFactoryComEscrow();
      await assert.rejects(
        escrow.write.depositar({ account: terceiro.account, value: valor }),
        /Somente o contratante pode chamar essa funcao/
      );
    });

    it("deve rejeitar depósito com valor insuficiente", async () => {
      const { escrow, contratante } = await deployFactoryComEscrow();
      await assert.rejects(
        escrow.write.depositar({ account: contratante.account, value: parseEther("0.5") }),
        /Dinheiro Insuficiente/
      );
    });

    it("deve rejeitar depósito com valor em excesso", async () => {
      const { escrow, contratante } = await deployFactoryComEscrow();
      await assert.rejects(
        escrow.write.depositar({ account: contratante.account, value: parseEther("2") }),
        /Dinheiro Insuficiente/
      );
    });

    it("deve rejeitar segundo depósito após o primeiro", async () => {
      const { escrow, contratante, valor } = await deployFactoryComEscrow();
      await escrow.write.depositar({ account: contratante.account, value: valor });
      await assert.rejects(
        escrow.write.depositar({ account: contratante.account, value: valor }),
        /Estado do contrato precisa ser criado/
      );
    });
  });

  describe("Escrow — entregarServico()", () => {
    it("deve permitir que o prestador entregue após depósito", async () => {
      const { escrow, contratante, prestador, valor } = await deployFactoryComEscrow();
      await escrow.write.depositar({ account: contratante.account, value: valor });
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
      const { escrow, contratante, valor } = await deployFactoryComEscrow();
      await escrow.write.depositar({ account: contratante.account, value: valor });
      await assert.rejects(
        escrow.write.entregarServico({ account: contratante.account }),
        /Somente o prestador pode chamar essa funcao/
      );
    });
  });

  describe("Escrow — pagarPrestador()", () => {
    it("deve transferir o saldo para o prestador ao aprovar", async () => {
      const { escrow, publicClient, contratante, prestador, valor } =
        await deployFactoryComEscrow();

      await escrow.write.depositar({ account: contratante.account, value: valor });
      await escrow.write.entregarServico({ account: prestador.account });

      const saldoAntes = await publicClient.getBalance({ address: prestador.account!.address });
      await escrow.write.pagarPrestador({ account: contratante.account });
      const saldoDepois = await publicClient.getBalance({ address: prestador.account!.address });

      assert.ok(saldoDepois > saldoAntes, "Saldo do prestador deve aumentar");
      assert.equal(await escrow.read.estado(), Estado.FINALIZADO);
    });

    it("deve zerar o saldo do contrato após o pagamento", async () => {
      const { escrow, publicClient, contratante, prestador, valor } =
        await deployFactoryComEscrow();
      await escrow.write.depositar({ account: contratante.account, value: valor });
      await escrow.write.entregarServico({ account: prestador.account });
      await escrow.write.pagarPrestador({ account: contratante.account });
      assert.equal(await publicClient.getBalance({ address: escrow.address }), 0n);
    });

    it("deve rejeitar pagamento sem entrega prévia", async () => {
      const { escrow, contratante, valor } = await deployFactoryComEscrow();
      await escrow.write.depositar({ account: contratante.account, value: valor });
      await assert.rejects(
        escrow.write.pagarPrestador({ account: contratante.account }),
        /Projeto ainda nao foi entregue/
      );
    });

    it("deve rejeitar pagamento feito pelo prestador", async () => {
      const { escrow, contratante, prestador, valor } = await deployFactoryComEscrow();
      await escrow.write.depositar({ account: contratante.account, value: valor });
      await escrow.write.entregarServico({ account: prestador.account });
      await assert.rejects(
        escrow.write.pagarPrestador({ account: prestador.account }),
        /Somente o contratante pode chamar essa funcao/
      );
    });

    it("deve rejeitar pagamento duplicado após FINALIZADO", async () => {
      const { escrow, contratante, prestador, valor } = await deployFactoryComEscrow();
      await escrow.write.depositar({ account: contratante.account, value: valor });
      await escrow.write.entregarServico({ account: prestador.account });
      await escrow.write.pagarPrestador({ account: contratante.account });
      await assert.rejects(
        escrow.write.pagarPrestador({ account: contratante.account }),
        /Projeto ainda nao foi entregue/
      );
    });
  });

  describe("Escrow — pagarPorPrazoExpirado()", () => {
    it("deve permitir saque pelo prestador após 3 dias sem aprovação", async () => {
      const { escrow, publicClient, contratante, prestador, valor, networkHelpers } =
        await deployFactoryComEscrow();

      await escrow.write.depositar({ account: contratante.account, value: valor });
      await escrow.write.entregarServico({ account: prestador.account });
      await networkHelpers.time.increase(3 * 24 * 60 * 60 + 1);

      const saldoAntes = await publicClient.getBalance({ address: prestador.account!.address });
      await escrow.write.pagarPorPrazoExpirado({ account: prestador.account });
      const saldoDepois = await publicClient.getBalance({ address: prestador.account!.address });

      assert.ok(saldoDepois > saldoAntes, "Saldo do prestador deve aumentar");
      assert.equal(await escrow.read.estado(), Estado.FINALIZADO);
    });

    it("deve rejeitar saque antes de 3 dias", async () => {
      const { escrow, contratante, prestador, valor, networkHelpers } =
        await deployFactoryComEscrow();

      await escrow.write.depositar({ account: contratante.account, value: valor });
      await escrow.write.entregarServico({ account: prestador.account });
      await networkHelpers.time.increase(24 * 60 * 60);

      await assert.rejects(
        escrow.write.pagarPorPrazoExpirado({ account: prestador.account }),
        /Prazo de 3 dias nao expirou/
      );
    });

    it("deve rejeitar saque se serviço não foi entregue", async () => {
      const { escrow, contratante, prestador, valor, networkHelpers } =
        await deployFactoryComEscrow();

      await escrow.write.depositar({ account: contratante.account, value: valor });
      await networkHelpers.time.increase(3 * 24 * 60 * 60 + 1);

      await assert.rejects(
        escrow.write.pagarPorPrazoExpirado({ account: prestador.account }),
        /Projeto ainda nao foi entregue/
      );
    });

    it("deve rejeitar saque por terceiros mesmo após 3 dias", async () => {
      const { escrow, contratante, prestador, terceiro, valor, networkHelpers } =
        await deployFactoryComEscrow();

      await escrow.write.depositar({ account: contratante.account, value: valor });
      await escrow.write.entregarServico({ account: prestador.account });
      await networkHelpers.time.increase(3 * 24 * 60 * 60 + 1);

      await assert.rejects(
        escrow.write.pagarPorPrazoExpirado({ account: terceiro.account }),
        /Somente o prestador pode chamar essa funcao/
      );
    });
  });

  describe("Escrow — reembolsar()", () => {
    it("deve permitir reembolso ao contratante após 30 dias sem entrega", async () => {
      const { escrow, publicClient, contratante, valor, networkHelpers } =
        await deployFactoryComEscrow();

      await escrow.write.depositar({ account: contratante.account, value: valor });
      await networkHelpers.time.increase(30 * 24 * 60 * 60 + 1);

      const saldoAntes = await publicClient.getBalance({ address: contratante.account!.address });
      await escrow.write.reembolsar({ account: contratante.account });
      const saldoDepois = await publicClient.getBalance({ address: contratante.account!.address });

      assert.ok(saldoDepois > saldoAntes, "Saldo do contratante deve aumentar");
      assert.equal(await escrow.read.estado(), Estado.FINALIZADO);
      assert.equal(await publicClient.getBalance({ address: escrow.address }), 0n);
    });

    it("deve rejeitar reembolso antes de 30 dias", async () => {
      const { escrow, contratante, valor, networkHelpers } =
        await deployFactoryComEscrow();

      await escrow.write.depositar({ account: contratante.account, value: valor });
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
      const { escrow, contratante, prestador, valor, networkHelpers } =
        await deployFactoryComEscrow();

      await escrow.write.depositar({ account: contratante.account, value: valor });
      await networkHelpers.time.increase(30 * 24 * 60 * 60 + 1);

      await assert.rejects(
        escrow.write.reembolsar({ account: prestador.account }),
        /Somente o contratante pode chamar essa funcao/
      );
    });

    it("deve rejeitar reembolso após serviço já entregue", async () => {
      const { escrow, contratante, prestador, valor, networkHelpers } =
        await deployFactoryComEscrow();

      await escrow.write.depositar({ account: contratante.account, value: valor });
      await escrow.write.entregarServico({ account: prestador.account });
      await networkHelpers.time.increase(30 * 24 * 60 * 60 + 1);

      await assert.rejects(
        escrow.write.reembolsar({ account: contratante.account }),
        /Nao tem deposito para reembolsar/
      );
    });
  });

  describe("Escrow — eventos", () => {
    it("deve emitir EscrowCriado ao criar escrow", async () => {
      const { factory, publicClient, contratante, prestador } = await deployFactory();
      const hash = await factory.write.criaEscrow(
        [prestador.account!.address, parseEther("1")],
        { account: contratante.account }
      );
      const recibo = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(recibo.logs.length > 0, true);
    });

    it("deve emitir ServicoDepositado ao depositar", async () => {
      const { escrow, publicClient, contratante, valor } = await deployFactoryComEscrow();
      const hash = await escrow.write.depositar({ account: contratante.account, value: valor });
      const recibo = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(recibo.logs.length > 0, true);
    });

    it("deve emitir ServicoEntregue ao entregar", async () => {
      const { escrow, publicClient, contratante, prestador, valor } =
        await deployFactoryComEscrow();
      await escrow.write.depositar({ account: contratante.account, value: valor });
      const hash = await escrow.write.entregarServico({ account: prestador.account });
      const recibo = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(recibo.logs.length > 0, true);
    });

    it("deve emitir PagamentoRealizado ao pagar prestador", async () => {
      const { escrow, publicClient, contratante, prestador, valor } =
        await deployFactoryComEscrow();
      await escrow.write.depositar({ account: contratante.account, value: valor });
      await escrow.write.entregarServico({ account: prestador.account });
      const hash = await escrow.write.pagarPrestador({ account: contratante.account });
      const recibo = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(recibo.logs.length > 0, true);
    });

    it("deve emitir ReembolsoRealizado ao reembolsar", async () => {
      const { escrow, publicClient, contratante, valor, networkHelpers } =
        await deployFactoryComEscrow();
      await escrow.write.depositar({ account: contratante.account, value: valor });
      await networkHelpers.time.increase(30 * 24 * 60 * 60 + 1);
      const hash = await escrow.write.reembolsar({ account: contratante.account });
      const recibo = await publicClient.waitForTransactionReceipt({ hash });
      assert.equal(recibo.logs.length > 0, true);
    });
  });

  describe("Fluxo completo", () => {
    it("ciclo normal: criar → depositar → entregar → pagar", async () => {
      const { escrow, publicClient, contratante, prestador, valor } =
        await deployFactoryComEscrow();

      assert.equal(await escrow.read.estado(), Estado.CRIADO);

      await escrow.write.depositar({ account: contratante.account, value: valor });
      assert.equal(await escrow.read.estado(), Estado.DEPOSITADO);
      assert.equal(await publicClient.getBalance({ address: escrow.address }), valor);

      await escrow.write.entregarServico({ account: prestador.account });
      assert.equal(await escrow.read.estado(), Estado.ENTREGUE);

      await escrow.write.pagarPrestador({ account: contratante.account });
      assert.equal(await escrow.read.estado(), Estado.FINALIZADO);
      assert.equal(await publicClient.getBalance({ address: escrow.address }), 0n);
    });

    it("ciclo com prazo expirado: criar → depositar → entregar → prazo → saque", async () => {
      const { escrow, publicClient, contratante, prestador, valor, networkHelpers } =
        await deployFactoryComEscrow();

      await escrow.write.depositar({ account: contratante.account, value: valor });
      await escrow.write.entregarServico({ account: prestador.account });
      await networkHelpers.time.increase(3 * 24 * 60 * 60 + 1);
      await escrow.write.pagarPorPrazoExpirado({ account: prestador.account });

      assert.equal(await escrow.read.estado(), Estado.FINALIZADO);
      assert.equal(await publicClient.getBalance({ address: escrow.address }), 0n);
    });

    it("ciclo com reembolso: criar → depositar → 30 dias → reembolso", async () => {
      const { escrow, publicClient, contratante, valor, networkHelpers } =
        await deployFactoryComEscrow();

      await escrow.write.depositar({ account: contratante.account, value: valor });
      assert.equal(await escrow.read.estado(), Estado.DEPOSITADO);

      await networkHelpers.time.increase(30 * 24 * 60 * 60 + 1);
      await escrow.write.reembolsar({ account: contratante.account });

      assert.equal(await escrow.read.estado(), Estado.FINALIZADO);
      assert.equal(await publicClient.getBalance({ address: escrow.address }), 0n);
    });
  });
});