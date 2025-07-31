import { createSmartAccountClient } from 'permissionless';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { createPublicClient, http } from 'viem';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { createWalletClient, custom } from 'viem';
import { monadTestnet } from './chains';

export async function setupSmartAccount(wallet, pimlicoApiKey) {
  try {
    // Switch to Monad testnet
  await wallet.switchChain(monadTestnet.id);
  const provider = await wallet.getEthereumProvider();

  const viemWalletClient = createWalletClient({
    account: wallet.address,
    chain: monadTestnet,
    transport: custom(provider),
  });

  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(monadTestnet.rpcUrls.default.http[0]),
  });

    // Create Pimlico client with proper API key
  const pimlicoClient = createPimlicoClient({
      transport: http(`https://api.pimlico.io/v2/${monadTestnet.id}/rpc?apikey=${pimlicoApiKey}`),
  });

    // Create simple smart account
  const account = await toSimpleSmartAccount({
    client: publicClient,
    owner: viemWalletClient,
  });

    // Create smart account client with proper gas estimation
  const smartAccountClient = createSmartAccountClient({
    account,
    chain: monadTestnet,
      bundlerTransport: http(`https://api.pimlico.io/v2/${monadTestnet.id}/rpc?apikey=${pimlicoApiKey}`),
    paymaster: pimlicoClient,
    userOperation: {
        estimateFeesPerGas: async () => {
          try {
            const gasPrice = await pimlicoClient.getUserOperationGasPrice();
            console.log('Pimlico gas price:', gasPrice);
            return gasPrice.fast;
          } catch (error) {
            console.error('Failed to get gas price from Pimlico:', error);
            // Fallback gas price for Monad testnet - VERY HIGH VALUES
            console.log('Using fallback gas price for Monad testnet');
            return {
              feePerGas: 500000000000n, // 500 gwei (extremely high)
              maxFeePerGas: 1000000000000n, // 1000 gwei (extremely high)
              maxPriorityFeePerGas: 250000000000n, // 250 gwei (extremely high)
            };
          }
        },
    },
  });

  return smartAccountClient;
  } catch (error) {
    console.error('Smart account setup failed:', error);
    throw new Error(`Smart account setup failed: ${error.message}`);
  }
}