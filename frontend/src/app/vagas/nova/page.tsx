'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { supabase } from '@/lib/supabase';

// Mock simples de tokens para o MVP (você pode colocar os endereços reais dos seus ERC-20 na Sepolia depois)
const TOKENS_DISPONIVEIS = [
  { simbolo: 'USDC', endereco: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' }, // Exemplo USDC Sepolia
  { simbolo: 'USDT', endereco: '0xaA8E23Fb1079EA71e0a56F48a2AA51851D8433D0' }, // Exemplo USDT Sepolia
  { simbolo: 'WETH', endereco: '0x7b79995e5f793A07Bc00c21412e50ecae098E7f9' }
];

export default function NovaVaga() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);

  // Estados do formulário
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [tokenAddress, setTokenAddress] = useState(TOKENS_DISPONIVEIS[0].endereco);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address) {
      setErro('Por favor, conecte a sua carteira antes de publicar a vaga.');
      return;
    }

    setLoading(true);
    setErro('');

    try {
      // Inserindo os dados diretamente no Supabase!
      const { error } = await supabase.from('vagas').insert([
        {
          titulo,
          descricao,
          valor: parseFloat(valor),
          token_address: tokenAddress,
          contratante_address: address, // Pega o endereço logado na MetaMask automaticamente
          status: 'aberta' // Valor padrão por garantia
        }
      ]);

      if (error) throw error;

      // Se der certo, redireciona para a página principal
      alert('Vaga publicada com sucesso no Supabase!');
      router.push('/');
    } catch (err: any) {
      console.error(err);
      setErro(err.message || 'Erro ao salvar a vaga. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 shadow-xl">
        
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Criar Nova Vaga</h1>
            <p className="text-sm text-zinc-400 mt-1">Publique o seu projeto no ecossistema Web2 para receber propostas de freelancers.</p>
          </div>
          <ConnectButton label="Conectar" accountStatus="avatar" chainStatus="none" />
        </div>

        {/* Validação de Carteira Conectada */}
        {!isConnected ? (
          <div className="bg-zinc-950/50 border border-dashed border-zinc-800 rounded-xl p-8 text-center flex flex-col items-center justify-center">
            <p className="text-zinc-400 mb-4 max-w-md">
              Você precisa de uma carteira Web3 conectada para publicar uma vaga, pois salvaremos o seu endereço como o contratante oficial do projeto.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {erro && (
              <div className="bg-red-900/20 border border-red-500/50 text-red-400 p-4 rounded-lg text-sm">
                {erro}
              </div>
            )}

            {/* Título */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Título do Projeto</label>
              <input
                type="text"
                required
                placeholder="Ex: Desenvolvimento de Dashboard Next.js para DeFi"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Descrição dos Requisitos</label>
              <textarea
                required
                rows={5}
                placeholder="Detalhe o escopo do projeto, prazos esperados e as habilidades necessárias para o freelancer..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
              />
            </div>

            {/* Valor e Token Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Orçamento */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Orçamento / Valor</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Token de Pagamento */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Token de Pagamento</label>
                <select
                  value={tokenAddress}
                  onChange={(e) => setTokenAddress(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                >
                  {TOKENS_DISPONIVEIS.map((tk) => (
                    <option key={tk.endereco} value={tk.endereco}>
                      {tk.simbolo} ({tk.endereco.slice(0,6)}...{tk.endereco.slice(-4)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Botão de Envio */}
            <div className="pt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push('/')}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-5 py-2.5 rounded-lg transition-colors font-medium text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg transition-colors font-medium text-sm shadow-lg shadow-blue-600/10"
              >
                {loading ? 'Publicando...' : 'Publicar Vaga de Graça'}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}