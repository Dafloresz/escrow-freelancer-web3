'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount, useWriteContract, useReadContract, usePublicClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { parseUnits } from 'viem';
import { supabase } from '@/lib/supabase';
import { ESCROW_FACTORY_ADDRESS, ESCROW_FACTORY_ABI } from '@/contracts';

// Endereço oficial do contrato USDC na rede Sepolia Testnet
const USDC_SEPOLIA_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

// ABI minimalista do padrão ERC20 necessária para checar e aprovar saldo de USDC
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

// 📜 ABI do Contrato Escrow Filho (Criado pela Fábrica) para Liberação e Disputas
const ESCROW_FILHO_ABI = [
  {
    "inputs": [],
    "name": "liberarPagamento", // Ajuste o nome conforme está no seu contrato Solidity (ex: release, liberar)
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "abrirDisputa", // Ajuste o nome conforme está no seu contrato Solidity (ex: contestar, abrirDisputa)
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

export default function GerenciarPropostas() {
  const { id } = useParams();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);

  // Hook do Wagmi para escrita de contratos inteligentes
  const { writeContractAsync } = useWriteContract();

  // Hook para ler recibos e aguardar confirmações da rede blockchain
  const publicClient = usePublicClient();

  // Estados
  const [vaga, setVaga] = useState<any>(null);
  const [propostas, setPropostas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [contratandoId, setContratandoId] = useState<number | null>(null);
  const [textoBotao, setTextoBotao] = useState<string>('');
  const [executandoAcaoEscrow, setExecutandoAcaoEscrow] = useState(false);

  // Lendo quanto de USDC o usuário logado já aprovou para a nossa Fábrica
  const { data: allowance, refetch: atualizarAllowance } = useReadContract({
    address: USDC_SEPOLIA_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, ESCROW_FACTORY_ADDRESS] : undefined,
  });

  // Lendo quanto de USDC o usuário logado possui na carteira
  const { data: saldoUSDC } = useReadContract({
    address: USDC_SEPOLIA_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
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

  // Função que executa a criação do Escrow na Blockchain (Passo 1)
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
        setTextoBotao('Aprovando USDC...');
        const txApprove = await writeContractAsync({
          address: USDC_SEPOLIA_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [ESCROW_FACTORY_ADDRESS, valorEmWeiUSDC],
        });
        await publicClient.waitForTransactionReceipt({ hash: txApprove });
        await atualizarAllowance();
      }

      setTextoBotao('Criando Escrow...');
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

      setTextoBotao('Minerando na Rede...');
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      const escrowAddressGerado = receipt.logs[0]?.address; 

      setTextoBotao('Salvando no Banco...');
      await supabase.from('vagas').update({ status: 'em_andamento', escrow_address: escrowAddressGerado }).eq('id', id);
      await supabase.from('propostas').update({ status: 'aceita' }).eq('id', proposta.id);

      alert(`Contratação concluída com Sucesso!`);
      carregarDadosVagaEPropostas();

    } catch (error: any) {
      console.error('Erro na contratação:', error);
    } finally {
      setContratandoId(null);
      setTextoBotao('');
    }
  };

  // 🛠️ PASSO 3: LIBERAR PAGAMENTO NO CONTRATO FILHO DO ESCROW
  const handleLiberarPagamento = async () => {
    if (!vaga?.escrow_address || !publicClient) return;
    try {
      setExecutandoAcaoEscrow(true);
      setTextoBotao('Liberando Fundos...');

      const tx = await writeContractAsync({
        address: vaga.escrow_address as `0x${string}`,
        abi: ESCROW_FILHO_ABI,
        functionName: 'liberarPagamento', // Nome da função de liberação no seu arquivo .sol
      });

      setTextoBotao('Confirmando na Rede...');
      await publicClient.waitForTransactionReceipt({ hash: tx });

      // Atualiza banco para concluído
      await supabase.from('vagas').update({ status: 'concluido' }).eq('id', id);
      alert('Pagamento liberado com sucesso para o Freelancer!');
      carregarDadosVagaEPropostas();
    } catch (error: any) {
      console.error(error);
      alert('Erro ao liberar pagamento. Verifique se a função do contrato bate com "liberarPagamento"');
    } finally {
      setExecutandoAcaoEscrow(false);
      setTextoBotao('');
    }
  };

  // 🛠️ PASSO 4: ABRIR DISPUTA NO CONTRATO FILHO DO ESCROW
  const handleAbrirDisputa = async () => {
    if (!vaga?.escrow_address || !publicClient) return;
    try {
      setExecutandoAcaoEscrow(true);
      setTextoBotao('Abrindo Disputa...');

      const tx = await writeContractAsync({
        address: vaga.escrow_address as `0x${string}`,
        abi: ESCROW_FILHO_ABI,
        functionName: 'abrirDisputa', // Nome da função de disputa no seu arquivo .sol
      });

      await publicClient.waitForTransactionReceipt({ hash: tx });

      await supabase.from('vagas').update({ status: 'disputa' }).eq('id', id);
      alert('Disputa aberta! O Árbitro foi acionado para avaliar o caso.');
      carregarDadosVagaEPropostas();
    } catch (error: any) {
      console.error(error);
      alert('Erro ao abrir disputa.');
    } finally {
      setExecutandoAcaoEscrow(false);
      setTextoBotao('');
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

  const IsDonoDaVaga = address && vaga && address.toLowerCase() === vaga.contratante_address.toLowerCase();

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
            Status: {vaga?.status}
          </span>
        </div>

        {!isConnected ? (
          <div className="text-center p-8 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400">
            Conecte a sua carteira de Contratante.
          </div>
        ) : !IsDonoDaVaga ? (
          <div className="text-center p-8 bg-red-950/20 border border-red-900/30 rounded-2xl text-red-400">
            Apenas o criador desta vaga tem acesso a este painel.
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* ⚡ INTERFACE SE A VAGA JÁ ESTIVER EM ANDAMENTO OU REVISÃO (PASSOS 3 E 4) */}
            {['em_andamento', 'revisao', 'disputa'].includes(vaga?.status) ? (
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4">
                <h3 className="text-md font-bold text-zinc-200">Contrato de Escrow Ativo</h3>
                <p className="text-xs text-zinc-400 font-mono bg-zinc-950 p-3 rounded border border-zinc-850 break-all">
                  Endereço do Escrow: {vaga.escrow_address}
                </p>
                
                {vaga.status === 'revisao' && (
                  <div className="bg-emerald-950/20 border border-emerald-900/40 p-4 rounded-xl text-sm text-emerald-400">
                    🎉 O freelancer marcou este projeto como entregue! Revise o trabalho antes de liberar o saldo.
                  </div>
                )}

                <div className="flex gap-4 pt-2">
                  <button
                    onClick={handleLiberarPagamento}
                    disabled={executandoAcaoEscrow || vaga.status === 'concluido'}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-white font-bold py-3 px-4 rounded-xl text-sm transition-colors"
                  >
                    {executandoAcaoEscrow ? textoBotao : 'Liberar Pagamento (USDC)'}
                  </button>
                  
                  {vaga.status !== 'disputa' && (
                    <button
                      onClick={handleAbrirDisputa}
                      disabled={executandoAcaoEscrow}
                      className="bg-zinc-800 hover:bg-red-950/40 hover:text-red-400 border border-zinc-700 text-zinc-300 font-bold py-3 px-6 rounded-xl text-sm transition-all"
                    >
                      {executandoAcaoEscrow ? 'Processando...' : 'Abrir Disputa'}
                    </button>
                  )}
                </div>
              </div>
            ) : vaga?.status === 'concluido' ? (
              <div className="text-center p-12 bg-emerald-950/10 border border-emerald-900/20 rounded-2xl text-emerald-400 font-bold">
                ✓ Este projeto foi finalizado e os fundos foram liberados com sucesso!
              </div>
            ) : (
              /* FLUXO PADRÃO: LISTAGEM DE PROPOSTAS COMPATÍVEL COM PASSO 1 */
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
                            {contratandoId === proposta.id ? (textoBotao || 'Processando...') : 'Aceitar Proposta'}
                          </button>
                        </div>
                      </div>
                    ))}
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