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

 que prenderia fundos para sempre |
| `_arbitro != address(0)` | Idem para o árbitro |
| `_tokenPagamento != address(0)` | Idem para o token ERC-20 |
| `_prestador != msg.sender` | Impede auto-contratação (anti-lavagem de dinheiro) |
| `arbitro != contratante && arbitro != prestador` | Garante que o árbitro é um terceiro genuinamente neutro |
| `_valor > 0` | Impede criação de contratos sem valor econômico |
 
#### Funções de Consulta
 
```solidity
// Retorna todos os escrows criados na plataforma
function exibirTodosEscrow() public view returns (address[] memory)
 
// Retorna os escrows de um usuário específico (contratante ou prestador)
function exibirEscrowUsuarioEspecifico(address _usuario) public view returns (address[] memory)
```
 
---
 
### 2. `Escrow.sol` (Contrato Filho)
Implementa uma **Máquina de Estados (State Machine)** rigorosa para o ciclo de vida do projeto.
 
#### Ciclo de Vida: Máquina de Estados
 
```
CRIADO → ACEITO → DEPOSITADO → ENTREGUE → FINALIZADO
                      ↓              ↓
                  EM_DISPUTA ────────┘
```
 
| Estado | Quem transita | Como sair |
|---|---|---|
| `CRIADO` | — | Prestador chama `aceitarContrato()` |
| `ACEITO` | Prestador | Contratante chama `depositar()` |
| `DEPOSITADO` | Contratante | Prestador chama `entregarServico()` |
| `ENTREGUE` | Prestador | Contratante chama `pagarPrestador()` |
| `EM_DISPUTA` | Qualquer parte | Árbitro chama `resolverDisputa()` |
| `FINALIZADO` | — | Estado terminal, sem retorno |
 
#### Mecanismos de Proteção Automática
 
Além do fluxo principal, o contrato possui dois mecanismos de proteção contra abandono:
 
**Proteção ao Prestador — `pagarPorPrazoExpirado()`**
Se o contratante sumir após a entrega, o prestador pode sacar os fundos automaticamente decorridos **3 dias** sem aprovação.
 
```solidity
require(estado == Estado.ENTREGUE, "Projeto ainda nao foi entregue");
require(block.timestamp >= dataEntrega + 3 days, "Prazo de 3 dias nao expirou");
```
 
**Proteção ao Contratante — `reembolsar()`**
Se o prestador aceitar o contrato mas nunca entregar o serviço, o contratante pode resgatar os fundos após **30 dias** do depósito.
 
```solidity
require(estado == Estado.DEPOSITADO, "Nao tem deposito para reembolsar!");
require(block.timestamp >= dataDeposito + 30 days, "Aguarde 30 dias para poder reembolsar!");
```
 
#### Segurança de Modificadores de Acesso
 
Cada função sensível é protegida por modificadores granulares que blindam execuções de estado:
 
```solidity
modifier somentePrestador { require(msg.sender == prestador, ...); _; }
modifier somenteContratante { require(msg.sender == contratante, ...); _; }
modifier somenteArbitro { require(msg.sender == arbitro, ...); _; }
```
 
#### Mitigação de Reentrância (Checks-Effects-Interactions)
 
O estado interno é **sempre** atualizado para `FINALIZADO` **antes** de qualquer transferência de token, seguindo o padrão CEI e eliminando a superfície de ataque de reentrância:
 
```solidity
// ✅ Estado atualizado ANTES da transferência
estado = Estado.FINALIZADO;
bool sucesso = IERC20(tokenPagamento).transfer(prestador, valor);
require(sucesso, "A transferencia falhou!");
```
 
#### Resolução de Disputas
 
O árbitro resolve disputas com uma decisão binária e imutável:
 
```solidity
// true  → fundos vão para o prestador
// false → fundos são devolvidos ao contratante
function resolverDisputa(bool decisaoDoPrestador) public somenteArbitro
```
 
---

#### Fluxo de Integração: Criação de Escrow
 
```
1. Frontend chama IERC20.approve(escrowAddress, valor)
2. Frontend chama EscrowFactory.criaEscrow(prestador, arbitro, token, valor)
3. Frontend escuta o recibo da transação
4. viem.decodeEventLog() extrai o endereço do contrato filho do evento EscrowCriado
5. Endereço é persistido no Supabase vinculado à vaga
```
 
---

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
## Endereço do contrato

0x1Feda785F331746eE104916050E06022fFD93Ff2

Etherscan: https://sepolia.etherscan.io/address/0x1Feda785F331746eE104916050E06022fFD93Ff2

Observação: Embora tenha dois contratos no github, como estou usando Factory Pattern, meu contrato é apenas um contrato fábrica que cria outros contratos, por isso o envio de apenas um endereço.

No vídeo de demonstração é mostrado o endereço dos contratos criados e a utilização da Blockchain.

## 📷 Demonstração do Projeto na rede Sepolia
Youtube: https://youtu.be/Yh4aUE6hyvQ

Observação: Fiz um vídeo de demonstração, mostrando o funcionamento do projeto e seu funcionamento on-chain, ficou separado da pitch, pois a pitch ficou com o limite de 5 minutos.

---

## 🪧 Pitch
Youtube: https://youtu.be/PT62cuexYaQ

Drive: https://drive.google.com/drive/u/1/folders/1P9zrLWvveDkjMSehs9FrSRbnCpiFwZU-

Observação: No drive contém o mesmo vídeo do youtube (para backup) e a pitch em PDF, como foi pedido no requisito de entrega, a pitch em PDF também se encontra na pasta docs.

---
---
## 👨‍💻 Autor

Desenvolvido por *Thiago Figueiredo Piazentin*
* Github: Dafloresz
* Linkedin: https://www.linkedin.com/in/thiagopiazentin/

## 📄 Licença
Este projeto está sob a licença MIT.
Sinta-se livre para estudar, modificar e utilizar como base para outros projetos.
