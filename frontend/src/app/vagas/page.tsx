'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi'; 
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [vagas, setVagas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Captura o endereço conectado na MetaMask e o status de conexão
  const { address, isConnected } = useAccount();

  useEffect(() => {
    setMounted(true);
    buscarVagas();
  }, []);

  // Função que lê os dados do Supabase
  const buscarVagas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vagas')
        .select('*')
        .order('created_at', { ascending: false }); // Traz as mais recentes primeiro

      if (error) throw error;
      if (data) setVagas(data);
    } catch (error) {
      console.error('Erro ao carregar vagas:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col">
      {/* HEADER */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
            <Link href="/" className="text-xl font-black tracking-tight text-zinc-100 hover:opacity-80 transition-opacity">
              Escrow Freelancer
            </Link>
          </span>
          <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full border border-zinc-700">
            MVP Sepolia
          </span>
        </div>

        {mounted ? (
          <ConnectButton label="Conectar Carteira" accountStatus="address" chainStatus="icon" />
        ) : (
          <div className="h-10 w-36 bg-zinc-800 animate-pulse rounded-xl" />
        )}
      </header>

      {/* SEÇÃO PRINCIPAL / MURAL */}
      <section className="max-w-5xl w-full mx-auto p-6 md:py-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Mural de Vagas</h1>
            <p className="text-zinc-400 mt-1">Explore os projetos disponíveis e envie as tuas propostas em cripto.</p>
          </div>
          
          <Link href="/vagas/nova">
            <button className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-5 py-2.5 rounded-lg transition-colors shadow-lg shadow-blue-600/15 text-sm w-full md:w-auto">
              + Postar uma Vaga
            </button>
          </Link>
        </div>

        {/* LOADING STATE */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((n) => (
              <div key={n} className="h-32 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : vagas.length === 0 ? (
          /* NENHUMA VAGA ENCONTRADA */
          <div className="text-center py-16 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20">
            <p className="text-zinc-500 mb-2">Nenhuma vaga encontrada no momento.</p>
            <p className="text-sm text-zinc-600">Seja o primeiro a postar um projeto!</p>
          </div>
        ) : (
          /* LISTA DE VAGAS REAIS */
          <div className="grid grid-cols-1 gap-4">
            {vagas.map((vaga) => {
              // Verifica se a carteira conectada é a dona desta vaga específica
              const donoDaVaga = vaga.contratante_address || vaga.contratante_addres;
              const isDono = isConnected && address && donoDaVaga && address.toLowerCase() === donoDaVaga.toLowerCase();
              const isVagaAberta = !vaga.status || vaga.status === 'aberta';

              return (
                <div 
                  key={vaga.id} 
                  className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl hover:border-zinc-700 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-6"
                >
                  <div className="space-y-2 max-w-2xl">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-zinc-100">{vaga.titulo}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded border uppercase font-medium ${
                        isVagaAberta 
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        {vaga.status || 'aberta'}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400 line-clamp-2">{vaga.descricao}</p>
                    
                    {/* Endereço do Contratante cortadinho */}
                    <div className="text-xs text-zinc-500 flex items-center gap-1 pt-1">
                      <span>Contratante:</span>
                      <span className="font-mono bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                        {donoDaVaga ? 
                          `${donoDaVaga.slice(0, 6)}...${donoDaVaga.slice(-4)}` 
                          : 'Desconhecido'}
                      </span>
                    </div>
                  </div>

                  {/* Orçamento e Ações Dinâmicas */}
                  <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-4 border-t md:border-t-0 border-zinc-800 pt-4 md:pt-0">
                    <div className="text-left md:text-right">
                      <span className="text-xs text-zinc-500 block">Orçamento</span>
                      <span className="text-2xl font-black text-emerald-400 font-mono">
                        {vaga.valor} <span className="text-sm font-normal text-zinc-400">USDC</span>
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      {isVagaAberta ? (
                        <>
                          {/* VAGA ABERTA: Fluxo normal de propostas e candidatura */}
                          {isDono ? (
                            <Link href={`/vagas/${vaga.id}/propostas`} className="w-full md:w-auto">
                              <button className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-colors shadow-lg shadow-blue-600/10 whitespace-nowrap w-full">
                                📬 Ver Propostas
                              </button>
                            </Link>
                          ) : (
                            <Link href={`/vagas/${vaga.id}`} className="w-full md:w-auto">
                              <button className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap w-full">
                                Candidatar-se
                              </button>
                            </Link>
                          )}
                        </>
                      ) : (
                        /* 🌟 PROJETO FECHADO (EM ANDAMENTO, REVISÃO, ETC): Botão Inteligente Exclusivo */
                        <Link 
                          href={isDono ? `/vagas/${vaga.id}/propostas` : `/vagas/${vaga.id}`} 
                          className="w-full md:w-auto"
                        >
                          <button className="bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap w-full flex items-center justify-center gap-1">
                            💼 Gerenciar Projeto
                          </button>
                        </Link>
                      )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}