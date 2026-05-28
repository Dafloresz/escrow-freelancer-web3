import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";
import * as dotenv from "dotenv"; // 1. IMPORTA O DOTENV

dotenv.config(); // 2. ATIVA O DOTENV PARA LER O ARQUIVO .ENV

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545",
    },
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      // Ajustado para bater exatamente com o que o configVariable vai buscar no seu .env
      url: process.env.CHAVE_RPC_URL || "", 
      accounts: process.env.CHAVE_PRIVADA_METAMASK ? [process.env.CHAVE_PRIVADA_METAMASK] : [],
    },
  },
});