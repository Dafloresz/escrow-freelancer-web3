// frontend/src/contracts/index.ts

// 1. Endereço do seu contrato de fábrica na rede de testes Sepolia
export const ESCROW_FACTORY_ADDRESS = '0x1feda785f331746ee104916050e06022ffd93ff2' as const;

// 2. ABI oficial e completa do EscrowFactory
export const ESCROW_FACTORY_ABI = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "contratante",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "prestador",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "arbitro",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "tokenPagamento",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "escrow",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "valor",
        "type": "uint256"
      }
    ],
    "name": "EscrowCriado",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_prestador",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_arbitro",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_tokenPagamento",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_valor",
        "type": "uint256"
      }
    ],
    "name": "criaEscrow",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "escrowUsuario",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_usuario",
        "type": "address"
      }
    ],
    "name": "exibirEscrowUsuarioEspecifico",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "",
        "type": "address[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "exibirTodosEscrow",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "",
        "type": "address[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "todosOsEscrows",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;