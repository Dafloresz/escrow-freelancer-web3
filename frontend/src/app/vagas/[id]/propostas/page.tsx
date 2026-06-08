'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount, useWriteContract, useReadContract, usePublicClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { parseUnits, decodeEventLog } from 'viem'; 
import { supabase } from '@/lib/supabase';
import { ESCROW_FACTORY_ADDRESS, ESCROW_FACTORY_ABI } from '@/contracts';

const USDC_SEPOLIA_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

const ERC20_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" },
      { "internalType": "address", "name": "spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "spender", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  }, 
  {
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

const ESCROW_FILHO_ABI = [
  {
    "inputs": [],
    "name": "aceitarContrato", 
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "depositar",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "entregarServico",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "pagarPrestador", 
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "iniciarDisputa", 
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "pagarPorPrazoExpirado", 
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "reembolsar", 
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "estado",
    "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export default function GerenciarPropostas() {
  const { id } = useParams();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);

  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [vaga, setVaga] = useState<any>(null);
  const [propostas, setPropostas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [contratandoId, setContratandoId] = useState<number | null>(null);
  const [statusTextoAcao, setStatusTextoAcao] = useState<string>('');
  const [executandoAcaoEscrow, setExecutandoAcaoEscrow] = useState(false);

  const { data: allowance, refetch: atualizarAllowance } = useReadContract({
    address: USDC_SEPOLIA_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, ESCROW_FACTORY_ADDRESS] : undefined,
  });

  const { data: saldoUSDC } = useReadContract({
    address: USDC_SEPOLIA_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  const { data: estadoEscrow, refetch: atualizarEstadoEscrow } = useReadContract({
    address: vaga?.escrow_address as `0x${string}`,
    abi: ESCROW_FILHO_ABI,
    functionName: 'estado',
    query: {
      enabled: !!vaga?.escrow_address,
    }
  });

  useEffect(() => {
    setMounted(true);
    if (id) carregarDadosVagaEPropostas();
  }, [id]);

  const carregarDadosVagaEPropostas = async () => {
    try {
      setLoading(true);
      const { data: dadosVaga, error: erroVaga } = await supabase
        .from('vagas')
        .select('*')
        .eq('id', id)
        .single();

      if (erroVaga) throw erroVaga;
      setVaga(dadosVaga);

      const { data: dadosPropostas, error: erroPropostas } = await supabase
        .from('propostas')
        .select('*')
        .eq('vagas_id', id)
        .order('created_at', { ascending: false });

      if (erroPropostas) throw erroPropostas;
      setPropostas(dadosPropostas || []);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAceitarProposta = async (proposta: any) => {
    if (!address || !vaga || !publicClient) return;
    
    if (address.toLowerCase() !== vaga.contratante_address.toLowerCase()) {
      alert('Apenas o contratante que publicou a vaga pode aceitar propostas!');
      return;
    }

    try {
      setContratandoId(proposta.id);
      const valorEmWeiUSDC = parseUnits(proposta.valor_proposto.toString(), 6);
      const saldoAtual = saldoUSDC ? BigInt(saldoUSDC.toString()) : BigInt(0);
      
      if (saldoAtual < valorEmWeiUSDC) {
        alert(`Saldo insuficiente em USDC!`);
        return;
      }

      const limiteAprovadoAtual = allowance ? BigInt(allowance.toString()) : BigInt(0);

      if (limiteAprovadoAtual < valorEmWeiUSDC) {
        setStatusTextoAcao('Aprovando USDC...');
        const txApprove = await writeContractAsync({
          address: USDC_SEPOLIA_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [ESCROW_FACTORY_ADDRESS, valorEmWeiUSDC],
        });
        await publicClient.waitForTransactionReceipt({ hash: txApprove });
        await atualizarAllowance();
      }

      setStatusTextoAcao('Criando Escrow...');
      const arbitroTeste = "0x000000000000000000000000000000000000dEaD";

      const txHash = await writeContractAsync({
        address: ESCROW_FACTORY_ADDRESS,
        abi: ESCROW_FACTORY_ABI,
        functionName: 'criaEscrow',
        args: [
          proposta.freelancer_address as `0x${string}`,
          arbitroTeste as `0x${string}`,
          USDC_SEPOLIA_ADDRESS as `0x${string}`,
          valorEmWeiUSDC
        ],
      });

      setStatusTextoAcao('Minerando na Rede...');
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      
      let escrowAddressGerado = '';
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: ESCROW_FACTORY_ABI,
            data: log.data,
            topics: log.topics,
          });
        
          if (decoded.eventName === 'EscrowCriado' && decoded.args) {
            const args = decoded.args as any;
            if (args.escrow && args.escrow !== '0x0000000000000000000000000000000000000000') {
              escrowAddressGerado = args.escrow;
              break; 
            }
          }
        } catch (e) {
          continue; 
        }
      }

      if (!escrowAddressGerado) {
        throw new Error("Não foi possível encontrar o endereço do Escrow nos logs.");
      }

      setStatusTextoAcao('Salvando no Banco...');
      await supabase.from('vagas').update({ status: 'em_andamento', escrow_address: escrowAddressGerado }).eq('id', id);
      await supabase.from('propostas').update({ status: 'aceita' }).eq('id', proposta.id);

      alert(`Contratação concluída com Sucesso!`);
      carregarDadosVagaEPropostas();
    } catch (error: any) {
      console.error('Erro na contratação:', error);
      alert(error.shortMessage || error.message || 'Erro ao processar a contratação.');
    } finally {
      setContratandoId(null);
      setStatusTextoAcao('');
    }
  };

  const handleAceitarContrato = async () => {
    if (!vaga?.escrow_address || !publicClient) return;
  
    try {
      setExecutandoAcaoEscrow(true);
      setStatusTextoAcao('Aceitando contrato...');
  
      const txAceitar = await writeContractAsync({
        address: vaga.escrow_address as `0x${string}`,
        abi: ESCROW_FILHO_ABI,
        functionName: 'aceitarContrato',
      });
  
      setStatusTextoAcao('Processando na blockchain...');
      await publicClient.waitForTransactionReceipt({ hash: txAceitar });
  
      alert('Contrato aceito com sucesso! Agora o contratante pode depositar.');
      atualizarEstadoEscrow();
    } catch (error: any) {
      console.error("Erro ao aceitar contrato:", error);
      alert(error.shortMessage || error.message || 'Erro ao aceitar contrato.');
    } finally {
      setExecutandoAcaoEscrow(false);
      setStatusTextoAcao('');
    }
  };

  const handleDepositar = async () => {
    if (!vaga?.escrow_address || !publicClient || !vaga.valor) return;
    
    try {
      setExecutandoAcaoEscrow(true);
      const valorEmWeiUSDC = parseUnits(vaga.valor.toString(), 6);

      setStatusTextoAcao('Aprovando depósito...');
      const txApprove = await writeContractAsync({
        address: USDC_SEPOLIA_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [vaga.escrow_address as `0x${string}`, valorEmWeiUSDC],
      });
      
      setStatusTextoAcao('Confirmando aprovação...');
      await publicClient.waitForTransactionReceipt({ hash: txApprove });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      setStatusTextoAcao('Depositando fundos...');
      // GÁS REMOVIDO DAQUI PARA EVITAR O REVERT
      const txDeposit = await writeContractAsync({
        address: vaga.escrow_address as `0x${string}`,
        abi: ESCROW_FILHO_ABI,
        functionName: 'depositar',
      });

      setStatusTextoAcao('Processando depósito...');
      await publicClient.waitForTransactionReceipt({ hash: txDeposit });

      alert('Depósito realizado com sucesso!');
      atualizarEstadoEscrow();
    } catch (error: any) {
      console.error("Erro no depósito:", error);
      alert(error.shortMessage || error.message || 'Erro ao realizar depósito.');
    } finally {
      setExecutandoAcaoEscrow(false);
      setStatusTextoAcao('');
    }
  };

  const handleEntregarServico = async () => {
    if (!vaga?.escrow_address || !publicClient) return;

    try {
      setExecutandoAcaoEscrow(true);
      setStatusTextoAcao('Finalizando escopo...');

      const txConcluir = await writeContractAsync({
        address: vaga.escrow_address as `0x${string}`,
        abi: ESCROW_FILHO_ABI,
        functionName: 'entregarServico',
      });

      setStatusTextoAcao('Processando conclusão...');
      await publicClient.waitForTransactionReceipt({ hash: txConcluir });

      alert('Projeto marcado como concluído com sucesso!');
      atualizarEstadoEscrow();
    } catch (error: any) {
      console.error("Erro ao concluir projeto:", error);
      alert(error.shortMessage || error.message || 'Erro ao concluir projeto.');
    } finally {
      setExecutandoAcaoEscrow(false);
      setStatusTextoAcao('');
    }
  };

  const handleLiberarPagamento = async () => {
    if (!vaga?.escrow_address || !publicClient) return;
    try {
      setExecutandoAcaoEscrow(true);
      setStatusTextoAcao('Liberando Fundos...');

      // GÁS REMOVIDO DAQUI TAMBÉM
      const tx = await writeContractAsync({
        address: vaga.escrow_address as `0x${string}`,
        abi: ESCROW_FILHO_ABI,
        functionName: 'pagarPrestador',
      });

      setStatusTextoAcao('Confirmando na Rede...');
      await publicClient.waitForTransactionReceipt({ hash: tx });

      await supabase.from('vagas').update({ status: 'concluido' }).eq('id', id);
      alert('Pagamento liberado com sucesso!');
      carregarDadosVagaEPropostas();
    } catch (error: any) {
      console.error(error);
      alert(error.shortMessage || 'Erro ao liberar pagamento.');
    } finally {
      setExecutandoAcaoEscrow(false);
      setStatusTextoAcao('');
    }
  };

  const handleAbrirDisputa = async () => {
    if (!vaga?.escrow_address || !publicClient) return;
    try {
      setExecutandoAcaoEscrow(true);
      setStatusTextoAcao('Abrindo Disputa...');

      const tx = await writeContractAsync({
        address: vaga.escrow_address as `0x${string}`,
        abi: ESCROW_FILHO_ABI,
        functionName: 'iniciarDisputa',
      });

      await publicClient.waitForTransactionReceipt({ hash: tx });

      await supabase.from('vagas').update({ status: 'disputa' }).eq('id', id);
      alert('Disputa aberta!');
      carregarDadosVagaEPropostas();
    } catch (error: any) {
      console.error(error);
      alert(error.shortMessage || 'Erro ao abrir disputa.');
    } finally {
      setExecutandoAcaoEscrow(false);
      setStatusTextoAcao('');
    }
  };

    const handlePagarPorPrazoExpirado = async () => {
    if (!vaga?.escrow_address || !publicClient) return;
    try {
      setExecutandoAcaoEscrow(true);
      setStatusTextoAcao('Reivindicando por prazo...');
      const tx = await writeContractAsync({
        address: vaga.escrow_address as `0x${string}`,
        abi: ESCROW_FILHO_ABI,
        functionName: 'pagarPorPrazoExpirado',
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      alert('Pagamento resgatado por prazo expirado!');
      atualizarEstadoEscrow();
    } catch (error: any) {
      console.error(error);
      alert(error.shortMessage || 'O prazo de 3 dias após a entrega ainda não expirou.');
    } finally {
      setExecutandoAcaoEscrow(false);
      setStatusTextoAcao('');
    }
  };

  const handleReembolsarPorPrazo = async () => {
    if (!vaga?.escrow_address || !publicClient) return;
    try {
      setExecutandoAcaoEscrow(true);
      setStatusTextoAcao('Solicitando reembolso...');
      const tx = await writeContractAsync({
        address: vaga.escrow_address as `0x${string}`,
        abi: ESCROW_FILHO_ABI,
        functionName: 'reembolsar',
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      alert('Reembolso executado com sucesso!');
      atualizarEstadoEscrow();
    } catch (error: any) {
      console.error(error);
      alert(error.shortMessage || 'Aguarde o prazo de 30 dias após o depósito para poder reembolsar.');
    } finally {
      setExecutandoAcaoEscrow(false);
      setStatusTextoAcao('');
    }
  };

  if (!mounted) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center">
        <div className="animate-pulse text-zinc-400">Carregando dados...</div>
      </div>
    );
  }

  const propostaAceita = propostas.find((p) => p.status === 'aceita');
  
  const IsDonoDaVaga = address && vaga && address.toLowerCase() === vaga.contratante_address.toLowerCase();
  const IsFreelancer = address && propostaAceita && address.toLowerCase() === propostaAceita.freelancer_address.toLowerCase();
  
  const TemAcessoAoPainel = IsDonoDaVaga || IsFreelancer;

  const status = Number(estadoEscrow);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
        <button onClick={() => router.push(`/vagas`)} className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
          ← Voltar ao Mural
        </button>
        <ConnectButton label="Conectar" accountStatus="avatar" chainStatus="none" />
      </header>

      <div className="max-w-4xl w-full mx-auto p-6 my-4 space-y-6">
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex justify-between items-center">
          <div>
            <span className="text-xs text-zinc-500 uppercase tracking-wider font-mono">Gerenciamento do Projeto</span>
            <h1 className="text-2xl font-black mt-1 text-zinc-100">{vaga?.titulo}</h1>
            <p className="text-sm text-zinc-400 mt-2">{vaga?.descricao}</p>
          </div>
          <span className="text-xs font-mono bg-zinc-800 px-3 py-1.5 rounded-full border border-zinc-700 uppercase">
            Status On-Chain: {status === 0 ? 'CRIADO' : status === 1 ? 'ACEITO' : status === 2 ? 'DEPOSITADO' : status === 3 ? 'ENTREGUE' : status === 4 ? 'FINALIZADO' : 'EM DISPUTA'}
          </span>
        </div>

        {!isConnected ? (
          <div className="text-center p-8 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400">
            Conecte a sua carteira para continuar.
          </div>
        ) : !TemAcessoAoPainel ? (
          <div className="text-center p-8 bg-red-950/20 border border-red-900/30 rounded-2xl text-red-400">
            Apenas o contratante e o freelancer selecionado têm acesso a este painel.
          </div>
        ) : (
          <div className="space-y-4">
            
            {vaga?.escrow_address ? (
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4">
                <h3 className="text-md font-bold text-zinc-200">Painel Operacional do Escrow</h3>
                <p className="text-xs text-zinc-400 font-mono bg-zinc-950 p-3 rounded border border-zinc-850 break-all">
                  Endereço do Escrow: {vaga.escrow_address}
                </p>

                <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-xl flex flex-col gap-2">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Transparência On-Chain</p>
                  <a
                    href={`https://sepolia.etherscan.io/address/${vaga.escrow_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors w-fit"
                  >
                    Ver Contrato no Sepolia Etherscan
                  </a>
                </div>

                {/* LOGICA REORDENADA E FLUXO DINÂMICO EXATO */}
                <div className="flex flex-col gap-4 pt-2">
                  
                  {/* ESTADO 0: CRIADO */}
                  {status === 0 && (
                    <div className="bg-zinc-950 border border-zinc-850 p-6 rounded-xl">
                      <h4 className="text-sm font-bold text-amber-500 uppercase font-mono tracking-wide">Aba de Aceitar Contrato</h4>
                      <p className="text-xs text-zinc-400 mt-1 mb-4">O contrato foi gerado. O freelancer precisa assinar digitalmente para habilitar o depósito.</p>
                      {IsFreelancer ? (
                        <button
                          onClick={handleAceitarContrato}
                          disabled={executandoAcaoEscrow}
                          className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-800 text-white font-bold py-3 px-4 rounded-xl text-sm transition-colors"
                        >
                          {executandoAcaoEscrow ? statusTextoAcao : 'Aceitar Contrato'}
                        </button>
                      ) : (
                        <p className="text-sm text-zinc-400 italic text-center py-2">⏳ Aguardando o freelancer aceitar o contrato...</p>
                      )}
                    </div>
                  )}

                {/* ESTADO 1: ACEITO */}
                  {status === 1 && (
                    <div className="bg-zinc-950 border border-zinc-850 p-6 rounded-xl">
                      <h4 className="text-sm font-bold text-blue-500 uppercase font-mono tracking-wide">Aba de Depósito</h4>
                      <p className="text-xs text-zinc-400 mt-1 mb-4">O freelancer aceitou os termos. O contratante deve realizar o travamento dos fundos de garantia.</p>
                      {IsDonoDaVaga ? (
                        <button
                          onClick={handleDepositar}
                          disabled={executandoAcaoEscrow}
                          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 text-white font-bold py-3 px-4 rounded-xl text-sm transition-colors"
                        >
                          {executandoAcaoEscrow ? statusTextoAcao : 'Realizar Depósito (USDC)'}
                        </button>
                      ) : (
                        <p className="text-sm text-zinc-400 italic text-center py-2">⏳ Contrato aceito! Aguardando depósito do contratante...</p>
                      )}
                    </div>
                  )}

                  {/* ESTADO 2: DEPOSITADO */}
                  {status === 2 && (
                    <div className="bg-zinc-950 border border-zinc-850 p-6 rounded-xl">
                      <h4 className="text-sm font-bold text-emerald-500 uppercase font-mono tracking-wide">Aba do Projeto (Em Andamento)</h4>
                      <p className="text-xs text-zinc-400 mt-1 mb-4">Fundos integralizados na blockchain com segurança. O freelancer deve executar as tarefas.</p>
                      {IsFreelancer ? (
                        <button
                          onClick={handleEntregarServico}
                          disabled={executandoAcaoEscrow}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-white font-bold py-3 px-4 rounded-xl text-sm transition-colors"
                        >
                          {executandoAcaoEscrow ? statusTextoAcao : 'Marcar Projeto como Concluído'}
                        </button>
                      ) : (
                        <div className="space-y-4">
                          <p className="text-sm text-zinc-400 italic text-center">🛡️ Freelancer trabalhando... Os fundos estão travados.</p>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <button
                              onClick={handleAbrirDisputa}
                              disabled={executandoAcaoEscrow}
                              className="flex-1 bg-zinc-900 hover:bg-red-950/40 border border-zinc-800 text-red-400 text-xs py-2 rounded-lg transition-colors"
                            >
                              Abrir Disputa de Emergência
                            </button>
                            <button
                              onClick={handleReembolsarPorPrazo}
                              disabled={executandoAcaoEscrow}
                              className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 text-xs py-2 rounded-lg transition-colors"
                            >
                              Reivindicar Reembolso (Se passaram 30 dias)
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                 {/* ESTADO 3: ENTREGUE */}
                  {status === 3 && (
                    <div className="bg-zinc-950 border border-zinc-850 p-6 rounded-xl">
                      <h4 className="text-sm font-bold text-indigo-400 uppercase font-mono tracking-wide">Aba de Revisão e Liberação de Pagamento</h4>
                      <p className="text-xs text-zinc-400 mt-1 mb-4">O freelancer reportou a conclusão do escopo. Avalie a integridade antes de agir.</p>
                      {IsDonoDaVaga ? (
                        <div className="flex flex-col sm:flex-row gap-3">
                          <button
                            onClick={handleLiberarPagamento}
                            disabled={executandoAcaoEscrow}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl text-sm transition-colors"
                          >
                            Liberar Pagamento
                          </button>
                          <button
                            onClick={handleAbrirDisputa}
                            disabled={executandoAcaoEscrow}
                            className="flex-1 bg-red-950/40 hover:bg-red-900/40 border border-red-900 text-red-400 font-bold py-3 px-4 rounded-xl text-sm transition-colors"
                          >
                            Abrir Disputa
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <p className="text-sm text-zinc-400 italic text-center py-2">🎉 Trabalho entregue! Aguardando o contratante liberar o pagamento ou abrir disputa.</p>
                          <button
                            onClick={handlePagarPorPrazoExpirado}
                            disabled={executandoAcaoEscrow}
                            className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs py-2.5 rounded-xl transition-colors font-medium"
                          >
                            Resgatar Fundos (Se o contratante sumiu por mais de 3 dias)
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ESTADO 4: FINALIZADO */}
                  {status === 4 && (
                    <div className="text-center p-4 bg-emerald-950/10 border border-emerald-900/20 rounded-2xl text-emerald-400 font-bold text-sm">
                      ✓ Este projeto foi finalizado e os fundos foram liquidados com sucesso!
                    </div>
                  )}

                  {/* ESTADO 5: EM DISPUTA */}
                  {status === 5 && (
                    <div className="text-center p-4 bg-red-950/10 border border-red-900/20 rounded-2xl text-red-400 font-bold text-sm">
                      ⚖️ O projeto encontra-se em disputa regulamentar. Aguarde o parecer do Árbitro.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                {IsDonoDaVaga ? (
                  <>
                    <h2 className="text-lg font-bold text-zinc-200">Propostas Recebidas ({propostas.length})</h2>
                    {propostas.length === 0 ? (
                      <div className="text-center p-12 bg-zinc-900/50 border border-zinc-850 rounded-2xl text-zinc-500 text-sm">
                        Nenhuma proposta recebida ainda.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {propostas.map((proposta) => (
                          <div key={proposta.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="space-y-2 flex-1">
                              <span className="font-mono text-xs text-blue-400 bg-blue-500/5 border border-blue-500/10 px-2 py-1 rounded">
                                Freelancer: {proposta.freelancer_address.slice(0, 6)}...{proposta.freelancer_address.slice(-4)}
                              </span>
                              <p className="text-sm text-zinc-350">{proposta.comentario}</p>
                            </div>
                            <div className="flex flex-col items-end gap-4">
                              <div className="text-right">
                                <span className="text-lg font-mono font-bold text-emerald-400">{proposta.valor_proposto} USDC</span>
                              </div>
                              <button
                                onClick={() => handleAceitarProposta(proposta)}
                                disabled={contratandoId !== null || proposta.status !== 'pendente'}
                                className="bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 text-white text-xs font-bold px-4 py-2.5 rounded-lg min-w-[140px]"
                              >
                                {contratandoId === proposta.id ? (statusTextoAcao || 'Processando...') : 'Aceitar Proposta'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center p-8 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400">
                    Aguardando o contratante selecionar a sua proposta e criar o contrato Escrow.
                  </div>
                )}
              </>
            )}

          </div>
        )}
      </div>
    </main>
  );
}