'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function DetalhesVaga() {
  const { id } = useParams();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);

  // Estados dos dados
  const [vaga, setVaga] = useState<any>(null);
  const [freelancerContratado, setFreelancerContratado] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  // Estados do formulário de proposta
  const [descricaoProposta, setDescricaoProposta] = useState('');
  const [valorPedido, setValorPedido] = useState('');
  const [prazoDias, setPrazoDias] = useState('');
  const [loadingProposta, setLoadingProposta] = useState(false);
  const [loadingEntrega, setLoadingEntrega] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (id) buscarDetalhesVaga();
  }, [id]);

  const buscarDetalhesVaga = async () => {
    try {
      setLoading(true);
      
      // 1. Busca os detalhes da vaga
      const { data: dadosVaga, error: errorVaga } = await supabase
        .from('vagas')
        .select('*')
        .eq('id', id)
        .single();

      if (errorVaga) throw errorVaga;
      setVaga(dadosVaga);

      // 2. Se a vaga não estiver aberta, busca qual freelancer foi aceito para ela
      if (dadosVaga.status !== 'aberta') {
        const { data: dadosProposta, error: errorProposta } = await supabase
          .from('propostas')
          .select('freelancer_address')
          .eq('vagas_id', id)
          .eq('status', 'aceita')
          .maybeSingle();

        if (dadosProposta) {
          setFreelancerContratado(dadosProposta.freelancer_address.toLowerCase());
        }
      }
    } catch (err: any) {
      console.error(err);
      setErro('Não foi possível carregar os detalhes desta vaga.');
    } finally {
      setLoading(false);
    }
  };

  const handleEnviarProposta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address) {
      alert('Por favor, conecte a sua carteira MetaMask primeiro!');
      return;
    }

    if (address.toLowerCase() === vaga?.contratante_address?.toLowerCase()) {
      alert('Você é o criador desta vaga! Não pode enviar propostas para si mesmo.');
      return;
    }

    setLoadingProposta(true);

    try {
      const { error } = await supabase.from('propostas').insert([
        {
          vagas_id: parseInt(id as string) || id,
          freelancer_address: address,
          valor_proposto: parseFloat(valorPedido),
          prazo_dias: parseInt(prazoDias),
          comentario: descricaoProposta,
          status: 'pendente'
        }
      ]);

      if (error) throw error;

      alert('Proposta enviada com sucesso para o contratante!');
      setDescricaoProposta('');
      setValorPedido('');
      setPrazoDias('');
      router.push('/vagas');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao enviar proposta.');
    } finally {
      setLoadingProposta(false);
    }
  };

  // 🛠️ FUNÇÃO DO PASSO 2: FREELANCER ENTREGA O TRABALHO
  const handleEntregarTrabalho = async () => {
    if (!id || !address) return;

    const confirmar = window.confirm("Tem certeza que deseja marcar este projeto como entregue? O contratante será notificado para liberar o pagamento.");
    if (!confirmar) return;

    setLoadingEntrega(true);
    try {
      const { error } = await supabase
        .from('vagas')
        .update({ status: 'revisao' })
        .eq('id', id);

      if (error) throw error;

      alert('Projeto marcado como entregue com sucesso! Aguarde a revisão do contratante.');
      buscarDetalhesVaga(); // Recarrega os dados na tela
    } catch (err: any) {
      console.error(err);
      alert('Erro ao processar entrega do projeto.');
    } finally {
      setLoadingEntrega(false);
    }
  };

  if (!mounted) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center">
        <div className="animate-pulse text-zinc-400">Carregando detalhes do projeto...</div>
      </div>
    );
  }

  if (erro || !vaga) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col items-center justify-center p-4">
        <p className="text-red-400 mb-4">{erro || 'Vaga não encontrada.'}</p>
        <button onClick={() => router.push('/vagas')} className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-lg">
          Voltar para o Mural
        </button>
      </div>
    );
  }

  const IsDonoDaVaga = address && vaga && address.toLowerCase() === vaga.contratante_address?.toLowerCase();
  const IsFreelancerContratado = address && freelancerContratado && address.toLowerCase() === freelancerContratado;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col">
      {/* HEADER */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-black tracking-tight text-zinc-100 hover:opacity-80 transition-opacity">
          Escrow Freelancer
        </Link>
        <ConnectButton label="Conectar" accountStatus="avatar" chainStatus="none" />
      </header>

      {/* SUB-MENU DE NAVEGAÇÃO INTERNA */}
      <div className="max-w-5xl w-full mx-auto px-6 mt-4">
        <button onClick={() => router.push('/vagas')} className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1">
          ← Voltar para o Mural
        </button>
      </div>

      {/* GRID DE DETALHES */}
      <div className="max-w-5xl w-full mx-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
        
        {/* COLUNA DA ESQUERDA: Detalhes da Vaga */}
        <div className="md:col-span-2 space-y-6 bg-zinc-900 border border-zinc-800 p-6 md:p-8 rounded-2xl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h1 className="text-3xl font-black text-zinc-100">{vaga.titulo}</h1>
            <span className="text-xs font-mono bg-zinc-950 border border-zinc-850 text-zinc-400 px-3 py-1 rounded-full uppercase tracking-wider">
              {vaga.status}
            </span>
          </div>

          <div className="border-t border-zinc-800 pt-4">
            <h2 className="text-sm font-semibold text-zinc-400 mb-2">Descrição do Escopo</h2>
            <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{vaga.descricao}</p>
          </div>

          <div className="border-t border-zinc-800 pt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-zinc-500 block">Orçamento Máximo</span>
              <span className="text-xl font-mono font-bold text-emerald-400">{vaga.valor} USDC</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Endereço do Contratante</span>
              <span className="font-mono text-zinc-400 text-xs truncate block max-w-[200px]" title={vaga.contratante_address}>
                {vaga.contratante_address}
              </span>
            </div>
          </div>
        </div>

        {/* COLUNA DA DIREITA: PAINEL DINÂMICO */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl h-fit space-y-5">
          
          {isConnected && IsDonoDaVaga ? (
            /* CONTEXTO A: CONTRATANTE LOGADO (DONO DA VAGA) */
            <div className="space-y-4 py-1">
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-center">
                <p className="text-xs text-blue-400 font-semibold">✨ Você é o criador deste projeto</p>
              </div>
              <h2 className="text-lg font-bold text-zinc-100">Painel de Controle</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Gerencie candidatos, analise os prazos pedidos e envie os fundos com segurança para o contrato de Escrow.
              </p>
              
              <Link 
                href={`/vagas/${id}/propostas`}
                className="block w-full text-center bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-lg shadow-blue-600/10"
              >
                📬 Ver Propostas / Painel Escrow
              </Link>
            </div>
          ) : ['em_andamento', 'revisao', 'disputa', 'concluido'].includes(vaga.status) ? (
            /* CONTEXTO B: PROJETO JÁ FOI FECHADO (EM ANDAMENTO OU CONCLUÍDO) */
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-zinc-100">Status do Projeto</h2>
              
              {IsFreelancerContratado ? (
                <div className="space-y-4">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                    <p className="text-xs text-emerald-400 font-semibold">🚀 Você foi contratado para esta vaga!</p>
                  </div>

                  {vaga.status === 'em_andamento' && (
                    <>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Trabalhe no projeto e, assim que terminar todas as entregas, clique no botão abaixo para avisar o contratante.
                      </p>
                      <button
                        onClick={handleEntregarTrabalho}
                        disabled={loadingEntrega}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-white font-bold py-3 rounded-xl text-sm transition-colors shadow-lg shadow-emerald-600/10"
                      >
                        {loadingEntrega ? 'Enviando...' : '🏁 Marcar como Concluído'}
                      </button>
                    </>
                  )}

                  {vaga.status === 'revisao' && (
                    <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-xl text-center text-xs text-zinc-400">
                      ⏳ Trabalho enviado! O contratante está revisando para liberar os seus USDC.
                    </div>
                  )}

                  {vaga.status === 'disputa' && (
                    <div className="p-4 bg-red-950/20 border border-red-900/30 rounded-xl text-center text-xs text-red-400">
                      ⚠️ Uma disputa está aberta para este projeto. O Árbitro da plataforma irá avaliar.
                    </div>
                  )}

                  {vaga.status === 'concluido' && (
                    <div className="p-4 bg-emerald-950/20 border border-emerald-900/30 rounded-xl text-center text-xs text-emerald-400 font-bold">
                      ✓ Projeto Finalizado. O pagamento foi enviado para a sua carteira!
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-xl text-center text-xs text-zinc-500">
                  Esta vaga já foi preenchida e está em andamento com outro freelancer.
                </div>
              )}
            </div>
          ) : (
            /* CONTEXTO C: FREELANCER MANDANDO PROPOSTA (VAGA ABERTA) */
            <>
              <h2 className="text-lg font-bold text-zinc-100">Candidatar-se</h2>
              <p className="text-xs text-zinc-400">Envie a sua proposta técnica e financeira para o contratante analisar.</p>

              {!isConnected ? (
                <div className="text-center p-4 bg-zinc-950 border border-zinc-850 rounded-xl text-xs text-zinc-500">
                  Conecte a sua carteira MetaMask para habilitar o envio de propostas.
                </div>
              ) : (
                <form onSubmit={handleEnviarProposta} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Quanto quer cobrar? (USDC)</label>
                    <input
                      type="number"
                      required
                      placeholder="0.00"
                      value={valorPedido}
                      onChange={(e) => setValorPedido(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Prazo de entrega (em dias)</label>
                    <input
                      type="number"
                      required
                      placeholder="Ex: 5"
                      value={prazoDias}
                      onChange={(e) => setPrazoDias(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">A sua Proposta / Portfólio</label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Diga por que é o freelancer ideal..."
                      value={descricaoProposta}
                      onChange={(e) => setDescricaoProposta(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loadingProposta}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium py-2.5 rounded-lg text-sm transition-colors shadow-lg shadow-blue-600/10"
                  >
                    {loadingProposta ? 'Enviando...' : 'Enviar Proposta'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

      </div>
    </main>
  );
}