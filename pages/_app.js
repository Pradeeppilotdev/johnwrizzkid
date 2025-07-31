import '../styles/globals.css';
import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiConfig, createConfig } from 'wagmi';
import { monadTestnet } from '../utils/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'viem';

const queryClient = new QueryClient();

const wagmiConfig = createConfig({
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: http('https://testnet-rpc.monad.xyz/'),
  },
});

export default function App({ Component, pageProps }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiConfig config={wagmiConfig}>
        <PrivyProvider
          appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID}
          config={{
            embeddedWallets: {
              createOnLogin: 'all-users',
              requireUserConfirmation: false,
              noPromptOnSignature: true,
              autoConnect: true,
            },
            supportedChains: [monadTestnet],
            appearance: {
              theme: 'dark',
              accentColor: '#6366f1',
            },
            loginMethods: ['email', 'wallet'],
            defaultWallet: 'embedded',
          }}
        >
          <Component {...pageProps} />
        </PrivyProvider>
      </WagmiConfig>
    </QueryClientProvider>
  );
} 