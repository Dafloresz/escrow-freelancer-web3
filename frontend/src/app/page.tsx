'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col">
      {/* BARRA DE NAVEGAÇÃO (HEADER) */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
            Escrow Freelancer
          </span>
          <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full border border-zinc-700">
            MVP Sepolia
          </span>
        </div>

        {mounted ? (
          <ConnectButton 
            label="Conectar Carteira"
            accountStatus="address"
            chainStatus="icon"
          />
        ) : (
          <div className="h-10 w-36 bg-zinc-800 animate-pulse rounded-xl" />
        )}
      </header>

      {/* CONTEÚDO PRINCIPAL (LANDING PAGE) */}
      <section className="flex-1 flex flex-col items-center justify-center text-center p-6">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight max-w-2xl mb-4">
          Contrate freelancers com a segurança do <span className="text-blue-500">Escrow Web3</span>
        </h1>
        <p className="text-zinc-400 max-w-xl mb-8 text-base md:text-lg">
          O dinheiro do projeto fica retido em um contrato inteligente seguro e só é liberado para o freelancer quando o trabalho for entregue.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto justify-center">
          {/* BOTÃO QUE LEVA PARA O MURAL */}
          <Link href="/vagas" className="w-full sm:w-auto">
            <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-3 rounded-lg transition-colors shadow-lg shadow-blue-600/20">
              Ver Mural de Vagas
            </button>
          </Link>
          
          {/* BOTÃO QUE LEVA PARA CRIAR VAGA */}
          <Link href="/vagas/nova" className="w-full sm:w-auto">
            <button className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 font-medium px-6 py-3 rounded-lg transition-colors">
              Postar uma Vaga
            </button>
          </Link>
        </div>
      </section>
    </main>
  );
}