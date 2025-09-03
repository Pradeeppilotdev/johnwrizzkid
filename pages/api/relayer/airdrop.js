import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// GaslessAirdrop contract ABI (minimal)
const AIRDROP_ABI = [
	{
		inputs: [{ name: 'user', type: 'address' }],
		name: 'claimAirdrop',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [{ name: 'user', type: 'address' }],
		name: 'hasUserClaimed',
		outputs: [{ name: '', type: 'bool' }],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'owner',
		outputs: [{ name: '', type: 'address' }],
		stateMutability: 'view',
		type: 'function',
	},
];

// Monad testnet configuration
const MONAD_TESTNET = {
	id: 10143,
	name: 'Monad Testnet',
	nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
	rpcUrls: {
		default: { http: ['https://testnet-rpc.monad.xyz/'] },
		public: { http: ['https://testnet-rpc.monad.xyz/'] },
	},
};

const getRpcUrl = () => process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet-rpc.monad.xyz/';
const getContractAddress = () => process.env.NEXT_PUBLIC_AIRDROP_CONTRACT_ADDRESS;

const getPrivateKeys = () => {
	const keys = [];
	for (let i = 1; i <= 50; i++) {
		const key = process.env[`PRIVATE_KEY_${i}`];
		if (key && key.startsWith('0x') && key.length > 4) keys.push(key);
	}
	return keys;
};

const createWalletClients = () => {
	const privateKeys = getPrivateKeys();
	return privateKeys.map((pk) => {
		const account = privateKeyToAccount(pk);
		return createWalletClient({ account, chain: MONAD_TESTNET, transport: http(getRpcUrl()) });
	});
};

const publicClient = createPublicClient({ chain: MONAD_TESTNET, transport: http(getRpcUrl()) });

export default async function handler(req, res) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	try {
		const { userAddress, targetAddress } = req.body || {};
		if (!userAddress || typeof userAddress !== 'string' || !userAddress.startsWith('0x')) {
			return res.status(400).json({ error: 'User address required' });
		}
		
		// Use targetAddress if provided, otherwise fallback to userAddress
		const finalTargetAddress = targetAddress || userAddress;

		const contractAddress = getContractAddress();
		if (!contractAddress) {
			return res.status(500).json({ error: 'Contract address not configured' });
		}

		// Ensure we have at least one relayer key
		const walletClients = createWalletClients();
		if (walletClients.length === 0) {
			return res.status(500).json({ error: 'No relayer wallets configured' });
		}

		// Verify owner address and select appropriate wallet (must match Ownable owner)
		let ownerAddress;
		try {
			ownerAddress = await publicClient.readContract({
				address: contractAddress,
				abi: AIRDROP_ABI,
				functionName: 'owner',
			});
		} catch (_e) {
			// If owner() not available for some reason, fallback to first wallet
		}

		let walletClient = walletClients[0];
		if (ownerAddress) {
			const ownerClient = walletClients.find((wc) => wc.account.address.toLowerCase() === ownerAddress.toLowerCase());
			if (ownerClient) walletClient = ownerClient;
		}

		// Quick on-chain check to avoid double airdrops (check MGID wallet)
		try {
			const hasClaimed = await publicClient.readContract({
				address: contractAddress,
				abi: AIRDROP_ABI,
				functionName: 'hasUserClaimed',
				args: [userAddress], // Check MGID wallet to prevent double claims
			});
			if (hasClaimed) {
				return res.status(400).json({ error: 'User already claimed airdrop' });
			}
		} catch (err) {
			return res.status(500).json({ error: 'Failed to check claim status' });
		}

		// Simulate and send tx from the relayer (owner)
		const { request: txRequest } = await publicClient.simulateContract({
			address: contractAddress,
			abi: AIRDROP_ABI,
			functionName: 'claimAirdrop',
			args: [finalTargetAddress], // Send to target address (embedded wallet)
			account: walletClient.account,
		});

		const txHash = await walletClient.writeContract(txRequest);
		return res.status(200).json({ success: true, hash: txHash });
	} catch (error) {
		// Surface concise error messages
		const message = error && error.message ? error.message : 'Unknown error';
		return res.status(500).json({ error: 'Failed to process airdrop', details: message });
	}
}


