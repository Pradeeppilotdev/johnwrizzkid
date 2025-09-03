import { createPublicClient, http } from 'viem';

// GaslessAirdrop contract ABI (minimal - just for checking)
const AIRDROP_ABI = [
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'hasUserClaimed',
    outputs: [{ name: '', type: 'bool' }],
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

const getContractAddress = () => process.env.NEXT_PUBLIC_AIRDROP_CONTRACT_ADDRESS;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userAddress } = req.body || {};
    if (!userAddress || typeof userAddress !== 'string' || !userAddress.startsWith('0x')) {
      return res.status(400).json({ error: 'User address required' });
    }

    const contractAddress = getContractAddress();
    if (!contractAddress) {
      return res.status(500).json({ error: 'Contract address not configured' });
    }

    const publicClient = createPublicClient({ chain: MONAD_TESTNET, transport: http('https://testnet-rpc.monad.xyz/') });

    // Check if user already claimed on-chain
    try {
      const hasClaimed = await publicClient.readContract({
        address: contractAddress,
        abi: AIRDROP_ABI,
        functionName: 'hasUserClaimed',
        args: [userAddress],
      });

      return res.status(200).json({ 
        alreadyClaimed: Boolean(hasClaimed),
        userAddress,
        contractAddress 
      });
    } catch (err) {
      console.error('Failed to check claim status:', err);
      return res.status(500).json({ error: 'Failed to check claim status', details: err.message });
    }
  } catch (error) {
    const message = error && error.message ? error.message : 'Unknown error';
    return res.status(500).json({ error: 'Failed to check airdrop status', details: message });
  }
}

