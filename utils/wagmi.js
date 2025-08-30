// utils/wagmi.js
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import { createConfig, http } from 'wagmi';
import { monadTestnet } from './chains';
import { toPrivyWallet } from '@privy-io/cross-app-connect/rainbow-kit';

const MONAD_GAMES_APP_ID = process.env.NEXT_PUBLIC_MONAD_GAMES_CROSS_APP_ID || 'cmd8euall0037le0my79qpz42';

const connectors = connectorsForWallets(
	[
		{
			groupName: 'Global wallets',
			wallets: [
				toPrivyWallet({
					id: MONAD_GAMES_APP_ID,
					name: 'Monad Games ID',
					iconUrl: 'https://monad-games-id-site.vercel.app/icon.png',
				}),
			],
		},
	],
	{
		appName: 'John Wrizz Kid',
		projectId: 'demo',
	},
);

export const wagmiConfig = createConfig({
	chains: [monadTestnet],
	transports: {
		[monadTestnet.id]: http(monadTestnet.rpcUrls.default.http[0]),
	},
	connectors,
	ssr: true,
});



