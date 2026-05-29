'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { supabase } from '@/lib/supabase';

export default function GerenciarPropostas() {
  const { id } = useParams();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);

  // Estados
  const [vaga, setVaga] = useState<any>(null);
  const [propostas, setPropostas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [contratandoId, setContratandoId] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    if (id) carregarDadosVagaEPropostas();
  }, [id]);

  const carregarDadosVagaEPropostas = async () => {
    try {
      setLoading(true);

      // 1. Busca os detalhes da vaga para sabermos quem é o dono
      const { data: dadosVaga, error: erroVaga } = await supabase
        .from('vagas')
        .select('*')
        .eq('id', id)
        .single();

      if (erroVaga) throw erroVaga;
      setVaga(dadosVaga);

      // 2. Busca todas as propostas recebidas para esta vaga
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

  // Função que será conectada ao Smart Contract no Passo 2
  const handleAceitarProposta = async (proposta: any) => {
    if (!address) return;
    
    // Segurança visual: garante que só o dono da vaga pode aceitar
    if (address.toLowerCase() !== vaga.contratante_address.toLowerCase()) {
      alert('Apenas o contratante que publicou a vaga pode aceitar propostas!');
      return;
    }

    try {
      setContratandoId(proposta.id);
      
      // MENSAGEM PROVISÓRIA: No Passo 2 vamos trocar isso pela transação da Blockchain!
      alert(`Pronto para integrar com a Web3!\n\nIremos abrir a MetaMask para depositar ${proposta.valor_proposto} USDC no Escrow para o freelancer:\n${proposta.freelancer_address}`);
      
      // Exemplo de atualização no banco após o sucesso (futuro)
      // await supabase.from('propostas').update({ status: 'aceita' }).eq('id', proposta.id);
      // await supabase.from('vagas').update({ status: 'em_andamento' }).eq('id', id);

    } catch (error: any) {
      console.error(error);
      alert('Erro ao processar contratação.');
    } finally {
      setContratandoId(null);
    }
  };

  if (!mounted) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center">
        <div className="animate-pulse text-zinc-400">Carregando propostas recebidas...</div>
      </div>
    );
  }

  // Se o usuário conectou uma carteira que NÃO é a dona da vaga, barramos o acesso
  const IsDonoDaVaga = address && vaga && address.toLowerCase() === vaga.contratante_address.toLowerCase();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col">
      {/* HEADER */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
        <button onClick={() => router.push(`/vagas`)} className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
          ← Voltar ao Mural
        </button>
        <ConnectButton label="Conectar" accountStatus="avatar" chainStatus="none" />
      </header>

      <div className="max-w-4xl w-full mx-auto p-6 my-4 space-y-6">
        {/* INFO DO PROJETO */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
          <span className="text-xs text-zinc-500 uppercase tracking-wider font-mono">Gerenciamento do Projeto</span>
          <h1 className="text-2xl font-black mt-1 text-zinc-100">{vaga?.titulo}</h1>
          <p className="text-sm text-zinc-400 mt-2 line-clamp-2">{vaga?.descricao}</p>
        </div>

        {/* VERIFICAÇÃO DE SEGURANÇA NA TELA */}
        {!isConnected ? (
          <div className="text-center p-8 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400">
            Conecte a sua carteira de Contratante para gerenciar as propostas deste projeto.
          </div>
        ) : !IsDonoDaVaga ? (
          <div className="text-center p-8 bg-red-950/20 border border-red-900/30 rounded-2xl text-red-400">
            Apenas a carteira do contratante criador desta vaga (<span className="font-mono text-xs">{vaga?.contratante_address}</span>) possui autorização para ver e aceitar propostas.
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-zinc-200 flex items-center gap-2">
              Propostas Recebidas 
              <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-normal">
                {propostas.length}
              </span>
            </h2>

            {propostas.length === 0 ? (
              <div className="text-center p-12 bg-zinc-900/50 border border-zinc-850 rounded-2xl text-zinc-500 text-sm">
                Nenhum freelancer se candidatou a este projeto ainda.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {propostas.map((proposta) => (
                  <div key={proposta.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-zinc-700 transition-colors">
                    
                    {/* Detalhes Técnicos da Proposta */}
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-blue-400 bg-blue-500/5 border border-blue-500/10 px-2 py-1 rounded">
                          Freelancer: {proposta.freelancer_address.slice(0, 6)}...{proposta.freelancer_address.slice(-4)}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {new Date(proposta.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-350 whitespace-pre-wrap">{proposta.comentario}</p>
                    </div>

                    {/* Detalhes Financeiros e Ação */}
                    <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-4 pt-4 md:pt-0 border-t md:border-t-0 border-zinc-800">
                      <div className="text-left md:text-right">
                        <span className="text-xs text-zinc-500 block">Preço / Prazo</span>
                        <span className="text-lg font-mono font-bold text-emerald-400">{proposta.valor_proposto} USDC</span>
                        <span className="text-xs text-zinc-400 block">{proposta.prazo_dias} dias úteis</span>
                      </div>

                      <button
                        onClick={() => handleAceitarProposta(proposta)}
                        disabled={contratandoId !== null || proposta.status !== 'pendente'}
                        className="bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 text-white disabled:text-zinc-500 text-xs font-bold px-4 py-2.5 rounded-lg transition-colors"
                      >
                        {contratandoId === proposta.id ? 'Processando...' : proposta.status === 'pendente' ? 'Aceitar Proposta' : 'Encerrada'}
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}