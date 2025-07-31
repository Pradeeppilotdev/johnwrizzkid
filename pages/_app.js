import '../styles/globals.css';
import { PrivyProvider } from '@privy-io/react-auth';
import { monadTestnet } from '../utils/chains';

export default function App({ Component, pageProps }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID}
      config={{
        embeddedWallets: {
          createOnLogin: 'all-users',
          requireUserPasswordOnCreate: false,
          noPromptOnSignature: true,
        },
        loginMethods: ['email', 'wallet'],
        appearance: {
          theme: 'dark',
          accentColor: '#6366f1',
          showWalletLoginFirst: false,
        },
        supportedChains: [monadTestnet],
      }}
    >
      <Component {...pageProps} />
    </PrivyProvider>
  );
}