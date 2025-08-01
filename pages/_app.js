import '../styles/globals.css';
import { PrivyProvider } from '@privy-io/react-auth';
import { monadTestnet } from '../utils/chains';
import { useEffect, useState } from 'react';

export default function App({ Component, pageProps }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // During SSR or if no Privy App ID, render without Privy provider
  if (!isClient || !process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
    return <Component {...pageProps} />;
  }

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