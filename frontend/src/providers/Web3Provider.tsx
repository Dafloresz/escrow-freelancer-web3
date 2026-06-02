'use client';

import React from 'react';
import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// 1. Configuração do Wagmi / RainbowKit
const config = getDefaultConfig({
  appName: 'Escrow Freelancer MVP',
  projectId: 'YOUR_PROJECT_ID', // Para o MVP local, você pode deixar esse texto ou criar um ID no site do WalletConnect depois
  chains: [sepolia],
  ssr: true, // Habilita Server-Side Rendering amigável para o Next.js
});

// 2. Inicializa o Query Client (gerenciador de requisições)
const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}