# 💼 Web3 Freelance Marketplace: Escrow Architecture
Um protocolo descentralizado de prestação de serviços que utiliza smart contracts na EVM para garantir a execução financeira ponta a ponta, construído com uma arquitetura híbrida (Web2.5) e sem intermediários centralizado.

## ⚠️ O Problema que o Projeto Resolve

Diferente das plataformas Web2 tradicionais que cobram taxas abusivas de intermediação dos usuários, este marketplace devolve a liberdade de negociação aos participantes:
* **Taxas Abusivas:** Plaformas de freelancer cobram até 20% sobre o valor do projeto.
* **Custódia Centralizada:** O dinheiro fica retido na plataforma, sujeito a bloqueios de contas arbitrários e atrasos nos saques.
* **Falta de Transparência:** Resoluções de disputas muitas vezes são parciais e obscuras.

---

## 💡 A Solução do Projeto
Desenvolvi um dApp com arquitetura híbrida que elimina o intermediário financeiro, resolvendo o "Problema de Confiança" entre contratantes e freelancers utilizando contratos inteligentes EVM.

* **Zero Custódia Centralizada:** Os fundos do projeto (em USDC) são travados em um **Smart Contract de Escrow** inalterável. Ninguém, nem mesmo os criadores da plataforma, pode movimentar esse dinheiro.
* **Garantia Mútua:** O freelancer trabalha sabendo que o dinheiro já está depositado no contrato. O contratante sabe que o dinheiro só será liberado mediante a entrega do combinado.
* **Resolução Justa:** Em caso de problemas, um árbitro neutro é acionado on-chain para avaliar a situação e direcionar os fundos.
  
---

## 🏗️ Arquitetura de Smart Contracts

O protocolo on-chain foi desenvolvido em Solidity e implementa o padrão **Factory (Fábrica de Contratos)** para garantir isolamento de escopo e segurança dos fundos.
Em vez de rodar 100% on-chain (o que geraria custos proibitivos de gás para negociações simples), o sistema adota um modelo híbrido:

* **Off-chain (Supabase/PostgreSQL):** Gerencia o CRUD de vagas e propostas. Garante velocidade instantânea e **zero custo de gás** para interações cotidianas.
* **On-chain (Solidity):** Gerencia estritamente o cofre (Escrow), a custódia do token (USDC/ETH) e a liquidação financeira. Utiliza o padrão **Factory** para criar contratos filhos únicos por vaga.
  
### 1. `EscrowFactory.sol` (A Fábrica)
Atua como o ponto de entrada principal para novas contratações.
* **Delegação de Custódia:** Quando uma proposta é aceita, o Frontend invoca a função `criaEscrow`. O Contratante realiza o `approve` do ERC-20 (USDC) diretamente para a fábrica.
* **Deploy Dinâmico:** A fábrica faz o deploy de um novo contrato `Escrow.sol` instanciado com os parâmetros do projeto (Contratante, Prestador, Árbitro, Valor e Token).
* **Rastreabilidade:** Emite o evento `EscrowCriado`, contendo o endereço do contrato filho gerado.

### 2. `Escrow.sol` (Contrato Filho)
Implementa uma **Máquina de Estados (State Machine)** rigorosa para o ciclo de vida do projeto:
* **Enums de Estado:** O contrato transita entre `CRIADO`, `DEPOSITADO`, `ENTREGUE`, `FINALIZADO` e `EM_DISPUTA`.
* **Segurança de Modificadores:** Utilização de modificadores de acesso granulares (`somenteContratante`, `somentePrestador`, `somenteArbitro`) para blindar execuções de estado.
* **Mitigação de Reentrância (Reentrancy Guard):** O estado interno é sempre atualizado (`estado = Estado.FINALIZADO`) **antes** da execução de chamadas externas ou transferências de tokens, seguindo o padrão Checks-Effects-Interactions.

## ⚙️ Integração Frontend (Web3 x Web2)

O Frontend (Next.js) atua como o orquestrador entre o banco de dados relacional e a blockchain, lidando com os desafios assíncronos da EVM:

* **Decodificação de Logs Nativos:** Para vincular o banco de dados (Web2) ao contrato filho (Web3), o frontend escuta o recibo da transação do Factory e utiliza a biblioteca `viem` (`decodeEventLog`) para fazer o parse seguro dos logs binários e extrair o endereço único gerado pelo evento `EscrowCriado`.
* **Bypass de RPC Gas Estimation:** Implementação de injeção de limites manuais de gás (`gas limit overrides`) nas chamadas de escrita (`pagarPrestador`, `iniciarDisputa`) para contornar a volatilidade e falhas intrínsecas de estimativa automática de nós RPC em testnets.
* **Gerenciamento de Estado de Transação:** Isolamento de instâncias e variáveis de estado local durante o fluxo de assinaturas (Approve -> Tx Execute -> Wait for Receipt) para evitar colisões no cache do Wagmi (`useWriteContract`).

## 🔮 Próximos Passos & Evolução do Protocolo (Roadmap)

Para transformar este MVP em um protocolo a nível de produção global, o ecossistema prevê dois UPGRADES importantes:

### 1. Arbitragem Descentralizada plug-and-play (Padrão Kleros)
No modelo atual de testes, o contratante define manualmente o endereço do árbitro ao criar a vaga. No entanto, no dia a dia real do mercado, essa abordagem gera vulnerabilidades (centralização da decisão ou conluio). 
O cenário ideal para produção é remover o fator humano centralizado e integrar o contrato filho a um protocolo de justiça descentralizada externa como o **Kleros**. Dessa forma, o contrato aponta para uma corte descentralizada de jurados criptoeconômicos com incentivos alinhados através de teoria dos jogos, garantindo um julgamento 100% neutro, anônimo e imutável para as disputas.

### 2. Oráculos de Validação com Inteligência Artificial (IA)
Para entregas de escopo padronizado (como código de programação, design de assets ou revisão de texto), o protocolo planeja implementar uma camada de Inteligência Artificial integrada através de Oráculos Web3 (como Chainlink Functions). 
A IA agirá como um validador automatizado em primeira instância: ao analisar os metadados da entrega (repositório do GitHub, arquivos de design), a IA poderá emitir um relatório de conformidade técnico e, caso o projeto cumpra todos os requisitos automatizados do escopo, o próprio contrato poderá autorizar o trigger de liberação dos fundos, reduzindo drasticamente a necessidade de intervenção humana ou disputas.

## 💻 Tecnologias utilizadas

### Frontend & Integração Blockchain
* **Next.js (App Router)** - Framework React.
* **Wagmi v2 & Viem** - Hooks React para Ethereum e primitivas de baixo nível para interação com a EVM e parse de ABIs/Eventos.
* **RainbowKit** - Gerenciamento de conexão multi-wallet.
* **Tailwind CSS** - UI e estilização.

### Backend & Infraestrutura
* **Supabase** - Banco de dados PostgreSQL, autenticação e RLS (Row Level Security).

### Smart Contracts
* **Solidity** - Linguagem de contratos inteligentes.
* **OpenZeppelin** - Padrões de interfaces ERC-20 e segurança.
* **Hardhat** - Ambiente de testes e deploy.

### IA
* **Claude AI** - Criação dos scripts de deploy
* **Gemini** - Criação do frontend utiliando Next.js e Javascript

---

## 🛠️ Como Rodar Localmente
Quer testar a aplicação na sua máquina local? Preparei um passo a passo detalhado com a configuração do banco de dados, chaves de API e carteiras Web3.
Para rodar este dApp na sua máquina, você precisará configurar o Frontend, o Backend (Supabase) e o Ambiente Web3.

👉 **[Clique aqui para acessar o Guia de Instalação](SETUP.md)**

---
## 👨‍💻 Autor

Desenvolvido por *Thiago Figueiredo Piazentin*
* Github: Dafloresz
* Linkedin: https://www.linkedin.com/in/thiagopiazentin/

## 📄 Licença
Este projeto está sob a licença MIT.
Sinta-se livre para estudar, modificar e utilizar como base para outros projetos.
