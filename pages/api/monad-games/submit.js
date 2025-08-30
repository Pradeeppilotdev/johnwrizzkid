import { createPublicClient, createWalletClient, http, encodeFunctionData, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { monadTestnet } from '../../../utils/chains';

const CONTRACT_ADDRESS = process.env.MONAD_GAMES_ID_CONTRACT || '0xceCBFF203C8B6044F52CE23D914A1bfD997541A4';
const SERVER_PK = process.env.SERVER_SUBMITTER_PRIVATE_KEY;
const EXPECTED_GAME_ADDRESS = process.env.GAME_SUBMITTER_ADDRESS;

// Minimal ABI for updatePlayerData(address,uint256,uint256)
const ABI = parseAbi([
  'function updatePlayerData(address player, uint256 scoreAmount, uint256 transactionAmount) external',
]);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!SERVER_PK) {
      return res.status(500).json({ error: 'Server not configured' });
    }
    const { player, scoreDelta, txDelta } = req.body || {};
    if (!player || typeof scoreDelta !== 'number' || typeof txDelta !== 'number') {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // Ensure deltas are non-negative integers
    const safeScore = BigInt(Math.max(0, Math.floor(scoreDelta)));
    const safeTx = BigInt(Math.max(0, Math.floor(txDelta)));

    // Build transaction data
    const data = encodeFunctionData({
      abi: ABI,
      functionName: 'updatePlayerData',
      args: [player, safeScore, safeTx],
    });

    const account = privateKeyToAccount(`0x${SERVER_PK.replace(/^0x/, '')}`);

    const publicClient = createPublicClient({
      chain: monadTestnet,
      transport: http(monadTestnet.rpcUrls.default.http[0]),
    });

    const walletClient = createWalletClient({
      chain: monadTestnet,
      account,
      transport: http(monadTestnet.rpcUrls.default.http[0]),
    });

    // Optional safety: ensure server key matches configured game address
    if (EXPECTED_GAME_ADDRESS && account.address.toLowerCase() !== EXPECTED_GAME_ADDRESS.toLowerCase()) {
      return res.status(500).json({ error: 'Server key does not match GAME_SUBMITTER_ADDRESS' });
    }

    const gas = await publicClient.estimateGas({
      account,
      to: CONTRACT_ADDRESS,
      data,
    });

    const hash = await walletClient.sendTransaction({
      account,
      to: CONTRACT_ADDRESS,
      data,
      gas,
    });

    return res.status(200).json({ txHash: hash });
  } catch (error) {
    console.error('❌ Failed to submit player data:', error);
    return res.status(500).json({ error: 'Submit failed', message: error.message });
  }
}


