import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * 1. Este script implanta o contrato âncora (EscrowFactory).
 * 2. Ele não passa argumentos no construtor [], pois a Factory nasce vazia.
 * 3. Ele não envia fundos (value), pois os fundos serão depositados nos Escrows individuais.
 */

export default buildModule("EscrowFactoryModule", (m) =>  {

    // m.contract recebe:
    // - O nome exato do contrato inteligente ("EscrowFactory")
    // - Um array vazio [] porque o construtor do seu contrato não pede parâmetros
    const escrowFactory = m.contract("EscrowFactory", []);

    // Retornamos a instância para que o Hardhat Ignition registre o endereço
    return { escrowFactory };
});