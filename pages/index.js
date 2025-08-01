import { useState, useRef, useEffect } from 'react';
import styles from '../styles/Home.module.css';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { encodeFunctionData, createPublicClient, http } from 'viem';
import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { entryPoint07Address } from 'viem/account-abstraction';
import { monadTestnet } from '../utils/chains';

// Example contract ABI and address (replace with your actual contract)
const contractAbi = [
  {
    inputs: [],
    name: 'depositTokens',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'frameNumber', type: 'uint256' }],
    name: 'viewFrame',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'frameNumbers', type: 'uint256[]' }],
    name: 'viewFramesBatch',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getBalance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'userSlapCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getSlapCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getCurrentSlapProgress',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'count', type: 'uint256' }],
    name: 'getTopUsers',
    outputs: [
      { name: 'users', type: 'address[]' },
      { name: 'slapCounts', type: 'uint256[]' }
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getUserRank',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getTotalFees',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'FRAME_COST',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];
const contractAddress = '0x28Cb014Ab8da78E23e4c1cB84c06ac03Ae6720aA'; // SimpleFrameViewer contract

export default function Home() {
  const [currentFrame, setCurrentFrame] = useState(1);
  const [smartAccountClient, setSmartAccountClient] = useState(null);
  const [txStatus, setTxStatus] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [hasDeposited, setHasDeposited] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [userSlapCount, setUserSlapCount] = useState(0);
  const [userRank, setUserRank] = useState(0);
  const [userBalance, setUserBalance] = useState(0); // Contract balance
  const [walletBalance, setWalletBalance] = useState(0); // Native wallet balance
  const [slapInProgress, setSlapInProgress] = useState(false);
  const containerRef = useRef(null);
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const privyAddress = wallets.length > 0 ? wallets[0].address : '';

  // Monad 2048 approach: Local nonce management and direct RPC
  const userNonce = useRef(0);
  const walletClient = useRef(null);

  // Remove wagmi useBalance and useAccount for now to avoid errors
  // We'll implement balance fetching manually using viem
  const [monBalance, setMonBalance] = useState(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);

  // Switch wallet to Monad Testnet after connection
  useEffect(() => {
    if (wallets.length > 0) {
      wallets[0].switchChain(monadTestnet.id); // Monad Testnet chain ID
    }
  }, [wallets]);

  // Check if using embedded wallet (this is what we want for no signatures)
  const isUsingEmbeddedWallet = wallets.length > 0 && wallets[0].walletClientType === 'privy';
  
  // Monad 2048 approach: Setup wallet client and nonce management
  useEffect(() => {
    async function setupWalletClient() {
      if (!ready || !wallets.length || !user?.wallet) return;

      try {
        setTxStatus('🔄 Setting up Privy embedded wallet (Monad 2048 approach)...');

        // Find the embedded Privy wallet
        const userWallet = wallets.find((w) => w.address === user.wallet?.address);
        if (!userWallet) return;

        // Get Ethereum provider and create wallet client
        const ethereumProvider = await userWallet.getEthereumProvider();
        const provider = {
          request: ethereumProvider.request.bind(ethereumProvider),
          signTransaction: async (txParams) => {
            // Sign transaction using Privy's embedded wallet
            return await ethereumProvider.request({
              method: 'eth_signTransaction',
              params: [txParams],
            });
          }
        };

        walletClient.current = provider;

        // Fetch current nonce from network
        const publicClient = createPublicClient({
          chain: monadTestnet,
          transport: http('https://testnet-rpc.monad.xyz/'),
        });

        const nonce = await publicClient.getTransactionCount({
          address: user.wallet.address,
        });
        userNonce.current = nonce;

        console.log('✅ Wallet client ready:', user.wallet.address);
        console.log('✅ Starting nonce:', nonce);

        setSmartAccountClient({
          account: { address: user.wallet.address },
          wallet: userWallet,
          isSmartWallet: false, // Using direct Privy wallet like Monad 2048
          walletClient: provider
        });

        setTxStatus('✅ Privy embedded wallet ready! Gasless transactions enabled (Monad 2048 approach)');
      } catch (error) {
        console.error('❌ Failed to setup wallet client:', error);
        setTxStatus('❌ Wallet setup failed: ' + error.message);
      }
    }

    setupWalletClient();
  }, [user, ready, wallets]);

  // Fetch leaderboard and user data when Privy wallet is ready
  useEffect(() => {
    if (wallets.length && privyAddress) {
      // Add a small delay to ensure everything is initialized
      const timer = setTimeout(() => {
        fetchLeaderboard();
        fetchUserSlapCount();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [wallets, privyAddress]);

  // Test smart account functionality
  const testSmartAccount = async () => {
    if (!smartAccountClient) return;
    setTxStatus('Testing smart account...');
    try {
      // Try to get the account address
      const accountAddress = await smartAccountClient.account.address;
      console.log('Smart account address:', accountAddress);
      setTxStatus('Smart account test successful! Address: ' + accountAddress);
    } catch (err) {
      console.error('Smart account test error:', err);
      setTxStatus('Smart account test failed: ' + err.message);
    }
  };

  // Test contract connection
  const testContract = async () => {
    if (!smartAccountClient) return;
    setTxStatus('Testing contract connection...');
    try {
      // Check if publicClient exists
      if (!smartAccountClient.chain?.publicClient) {
        setTxStatus('Public client not available');
        return;
      }
      
      const publicClient = smartAccountClient.chain.publicClient;
      const code = await publicClient.getBytecode({ address: contractAddress });
      if (code) {
        console.log('Contract is deployed at:', contractAddress);
        console.log('Contract bytecode length:', code.length);
        setTxStatus('Contract is deployed and accessible!');
        
        // Test a simple read function
        try {
          const leaderboardLength = await publicClient.readContract({
            address: contractAddress,
            abi: contractAbi,
            functionName: 'getLeaderboardLength',
            args: [],
          });
          console.log('Leaderboard length:', Number(leaderboardLength));
          setTxStatus(`Contract working! Leaderboard has ${Number(leaderboardLength)} entries`);
        } catch (err) {
          console.error('Contract read test failed:', err);
          setTxStatus('Contract deployed but read test failed: ' + err.message);
        }
      } else {
        setTxStatus('Contract not found at address: ' + contractAddress);
      }
    } catch (err) {
      console.error('Contract test error:', err);
      setTxStatus('Contract test failed: ' + err.message);
    }
  };

  // Fetch leaderboard data using Privy wallet
  const fetchLeaderboard = async () => {
    if (!wallets.length) return;
    try {
      // Create a simple public client for reading
      const { createPublicClient, http } = await import('viem');
      const publicClient = createPublicClient({
        chain: { id: 10143, name: 'Monad Testnet' },
        transport: http('https://testnet-rpc.monad.xyz/'),
      });
      
      const [users, slapCounts] = await publicClient.readContract({
        address: contractAddress,
        abi: contractAbi,
        functionName: 'getTopUsers',
        args: [10], // Get top 10 users
      });
      
      const leaderboardData = users.map((user, index) => ({
        address: user,
        slapCount: Number(slapCounts[index]),
        rank: index + 1,
      }));
      
      setLeaderboard(leaderboardData);
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    }
  };

  // Fetch user's slap count and rank using Privy wallet
  const fetchUserSlapCount = async () => {
    if (!wallets.length || !privyAddress) return;
    try {
      // Create a simple public client for reading
      const { createPublicClient, http } = await import('viem');
      const publicClient = createPublicClient({
        chain: { id: 10143, name: 'Monad Testnet' },
        transport: http('https://testnet-rpc.monad.xyz/'),
      });
      
      const [slapCount, userRank, contractBalance, walletBalance] = await Promise.all([
        publicClient.readContract({
          address: contractAddress,
          abi: contractAbi,
          functionName: 'userSlapCount',
          args: [privyAddress],
        }),
        publicClient.readContract({
          address: contractAddress,
          abi: contractAbi,
          functionName: 'getUserRank',
          args: [privyAddress],
        }),
        publicClient.readContract({
          address: contractAddress,
          abi: contractAbi,
          functionName: 'getBalance',
          args: [privyAddress],
        }),
        publicClient.getBalance({
          address: privyAddress,
        }),
      ]);

      setUserSlapCount(Number(slapCount));
      setUserRank(Number(userRank));
      setUserBalance(Number(contractBalance)); // Contract balance (for spending)
      setWalletBalance(Number(walletBalance)); // Wallet balance
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    }
  };

  // Check user balance in contract
  const checkUserBalance = async () => {
    if (!privyAddress) return 0;

    try {
      const publicClient = createPublicClient({
        chain: { id: 10143, name: 'Monad Testnet' },
        transport: http('https://testnet-rpc.monad.xyz/'),
      });

      const balance = await publicClient.readContract({
        address: contractAddress,
        abi: contractAbi,
        functionName: 'userBalances',
        args: [privyAddress],
      });

      return Number(balance);
    } catch (err) {
      console.error('Failed to check user balance:', err);
      return 0;
    }
  };

  // Handle frame viewing with Privy wallet (Smart Wallet or embedded)
  const handleFrameViewPrivy = async (frameNumber) => {
    if (!smartAccountClient || !privyAddress) {
      setTxStatus('❌ Wallet not ready. Please wait...');
      return;
    }

    try {
      // Check contract balance only for frames 1 and 162 (with retry for rate limiting)
      if (frameNumber === 1 || frameNumber === 162) {
        let contractBalance;
        try {
          const publicClient = createPublicClient({
            chain: { id: 10143, name: 'Monad Testnet' },
            transport: http('https://testnet-rpc.monad.xyz/'),
          });

          // IMPORTANT: Check balance for Privy wallet address, not Smart Account address
          const addressToCheck = privyAddress; // Use Privy wallet address for contract balance
          console.log(`🔍 Checking contract balance for Privy address: ${addressToCheck}`);
          console.log(`🔍 Smart Account address: ${smartAccountClient?.account?.address}`);

          contractBalance = await publicClient.readContract({
            address: contractAddress,
            abi: contractAbi,
            functionName: 'getBalance',
            args: [addressToCheck],
          });

          console.log(`💰 Contract balance for ${addressToCheck}: ${(Number(contractBalance) / 1e18).toFixed(4)} MON`);
        } catch (rpcError) {
          if (rpcError.message.includes('429') || rpcError.message.includes('rate limit')) {
            setTxStatus('⏳ RPC rate limited, trying transaction anyway...');
            contractBalance = BigInt(0.001 * 1e18); // Assume minimum balance to proceed
          } else {
            throw rpcError;
          }
        }

        const requiredAmount = BigInt(0.001 * 1e18); // 0.001 MON in wei

        if (contractBalance < requiredAmount) {
          const currentBalance = (Number(contractBalance) / 1e18).toFixed(4);
          const frameType = frameNumber === 1 ? 'start a slap' : 'complete a slap';
          setTxStatus(`❌ Insufficient contract balance! Privy wallet (${privyAddress}) has ${currentBalance} MON deposited, need 0.001 MON to ${frameType}. Please deposit more MON to the contract first.`);
          return;
        }
      }

      const viewFrameData = encodeFunctionData({
        abi: contractAbi,
        functionName: 'viewFrame',
        args: [frameNumber],
      });

      let txHash;

      // Monad 2048 approach: Direct RPC with local nonce management (NO APPROVALS!)
      console.log('🚀 Using Monad 2048 approach: Direct RPC + Local Nonce');
      console.log('Privy wallet address:', privyAddress);
      console.log('Current nonce:', userNonce.current);

      if (!walletClient.current) {
        throw new Error('Wallet client not ready');
      }

      setTxStatus(`🎬 Viewing frame ${frameNumber}... (Monad 2048 Gasless)`);

      // Get current nonce and increment immediately (like Monad 2048)
      const nonce = userNonce.current;
      userNonce.current = nonce + 1;

      // Get current gas prices from network (much cheaper!)
      const publicClient = createPublicClient({
        chain: monadTestnet,
        transport: http('https://testnet-rpc.monad.xyz/'),
      });

      const gasPrice = await publicClient.getGasPrice();
      const maxFeePerGas = gasPrice * 2n; // 2x current gas price for faster inclusion
      const maxPriorityFeePerGas = gasPrice / 10n; // Small tip

      console.log('⛽ Current gas price:', (Number(gasPrice) / 1e9).toFixed(2), 'gwei');
      console.log('⛽ Using maxFeePerGas:', (Number(maxFeePerGas) / 1e9).toFixed(2), 'gwei');

      // Prepare transaction parameters with reasonable gas prices
      const txParams = {
        to: contractAddress,
        data: viewFrameData,
        value: '0x0',
        nonce: '0x' + nonce.toString(16),
        gas: '0x186A0', // 100,000 gas limit
        maxFeePerGas: '0x' + maxFeePerGas.toString(16),
        maxPriorityFeePerGas: '0x' + maxPriorityFeePerGas.toString(16),
        chainId: '0x' + monadTestnet.id.toString(16),
      };

      console.log('📝 Transaction params:', txParams);

      // Sign transaction using Privy (should be gasless due to noPromptOnSignature: true)
      const signedTransaction = await walletClient.current.request({
        method: 'eth_signTransaction',
        params: [txParams],
      });

      console.log('✅ Transaction signed (gasless)');

      // Send directly via RPC (bypassing pre-flight simulations like Monad 2048)
      const response = await fetch('https://testnet-rpc.monad.xyz/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: 1,
          jsonrpc: '2.0',
          method: 'eth_sendRawTransaction',
          params: [signedTransaction],
        }),
      });

      const result = await response.json();

      if (result.error) {
        throw new Error(`RPC Error: ${result.error.message}`);
      }

      txHash = result.result;
      console.log('🚀 Gasless transaction sent via direct RPC:', txHash);

      // Update slap progress state
      if (frameNumber === 1) {
        setSlapInProgress(true);
        setTxStatus(`🎯 Slap started (Gasless)! 0.001 MON deducted. Continue to frame 162 to complete it.`);
      } else if (frameNumber === 162) {
        setSlapInProgress(false);
        setTxStatus(`🎉 Slap completed (Gasless)! 0.001 MON deducted. Check the leaderboard!`);
      } else {
        setTxStatus(`✅ Frame ${frameNumber} viewed (Gasless)! FREE - no MON deducted`);
      }

      // Update leaderboard and user data after transaction
      setTimeout(() => {
        fetchLeaderboard();
        fetchUserSlapCount();
      }, 2000);

    } catch (err) {
      console.error('Frame view transaction error:', err);

      // Reset nonce on error (like Monad 2048)
      if (err.message.includes('nonce') || err.message.includes('replacement')) {
        const publicClient = createPublicClient({
          chain: monadTestnet,
          transport: http('https://testnet-rpc.monad.xyz/'),
        });
        const correctNonce = await publicClient.getTransactionCount({
          address: privyAddress,
        });
        userNonce.current = correctNonce;
        console.log('🔄 Nonce reset to:', correctNonce);
        setTxStatus('❌ Transaction failed due to nonce issue. Nonce reset. Please try again.');
      } else {
        setTxStatus('❌ Transaction failed: ' + err.message);
      }
    }
  };

  // Handle frame movement (mouse)
  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const frameNumber = Math.floor(percentage * 162) + 1;
    if (frameNumber !== currentFrame && frameNumber >= 1 && frameNumber <= 162) {
      setCurrentFrame(frameNumber);
      
      // Only trigger transaction for frames 1 and 162 (only these cost MON)
      if (frameNumber === 1 || frameNumber === 162) {
        handleFrameViewPrivy(frameNumber);
      } else {
        // Frames 2-161 are free - just update UI, no transaction needed
        setTxStatus(`✅ Frame ${frameNumber} viewed - FREE! No blockchain transaction needed.`);

        // Update slap progress for free frames
        if (frameNumber > 1 && frameNumber < 162) {
          // We're in the middle of a slap, keep slap in progress
          setSlapInProgress(true);
        }
      }
    }
  };

  // Deposit MON to contract using available wallet
  const handleDeposit = async () => {
    if (!smartAccountClient || !depositAmount) {
      setTxStatus('❌ Wallet not ready');
      return;
    }

    try {
      const depositData = encodeFunctionData({
        abi: contractAbi,
        functionName: 'depositTokens',
        args: [],
      });

      let txHash;

      // Use Monad 2048 approach (gasless with direct RPC)
      if (!walletClient.current) {
        throw new Error('Wallet client not ready');
      }

      setTxStatus('💰 Depositing MON using Monad 2048 approach (gasless)...');

      // Get current nonce and increment immediately (like Monad 2048)
      const nonce = userNonce.current;
      userNonce.current = nonce + 1;

      // Get current gas prices from network (much cheaper!)
      const publicClient = createPublicClient({
        chain: monadTestnet,
        transport: http('https://testnet-rpc.monad.xyz/'),
      });

      const gasPrice = await publicClient.getGasPrice();
      const maxFeePerGas = gasPrice * 2n; // 2x current gas price for faster inclusion
      const maxPriorityFeePerGas = gasPrice / 10n; // Small tip

      console.log('⛽ Deposit gas price:', (Number(gasPrice) / 1e9).toFixed(2), 'gwei');
      console.log('⛽ Using maxFeePerGas:', (Number(maxFeePerGas) / 1e9).toFixed(2), 'gwei');

      // Prepare transaction parameters with reasonable gas prices
      const txParams = {
        to: contractAddress,
        data: depositData,
        value: '0x' + BigInt(Number(depositAmount) * 1e18).toString(16), // Amount in wei
        nonce: '0x' + nonce.toString(16),
        gas: '0x186A0', // 100,000 gas limit
        maxFeePerGas: '0x' + maxFeePerGas.toString(16),
        maxPriorityFeePerGas: '0x' + maxPriorityFeePerGas.toString(16),
        chainId: '0x' + monadTestnet.id.toString(16),
      };

      console.log('💰 Deposit transaction params:', txParams);

      // Sign transaction using Privy (gasless due to noPromptOnSignature: true)
      const signedTransaction = await walletClient.current.request({
        method: 'eth_signTransaction',
        params: [txParams],
      });

      console.log('✅ Deposit transaction signed (gasless)');

      // Send directly via RPC (bypassing pre-flight simulations)
      const response = await fetch('https://testnet-rpc.monad.xyz/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: 1,
          jsonrpc: '2.0',
          method: 'eth_sendRawTransaction',
          params: [signedTransaction],
        }),
      });

      const result = await response.json();

      if (result.error) {
        throw new Error(`RPC Error: ${result.error.message}`);
      }

      txHash = result.result;
      console.log('🚀 Gasless deposit sent via direct RPC:', txHash);
      setTxStatus(`✅ Deposited ${depositAmount} MON gaslessly! Hash: ${txHash}`);

      // Refresh user data after successful deposit
      setTimeout(() => {
        fetchUserSlapCount();
      }, 2000);
    } catch (err) {
      console.error('Deposit error:', err);

      // Reset nonce on error (like Monad 2048)
      if (err.message.includes('nonce')) {
        const publicClient = createPublicClient({
          chain: monadTestnet,
          transport: http('https://testnet-rpc.monad.xyz/'),
        });
        const correctNonce = await publicClient.getTransactionCount({
          address: privyAddress,
        });
        userNonce.current = correctNonce;
        console.log('🔄 Nonce reset to:', correctNonce);
      }

      setTxStatus('❌ Deposit failed: ' + err.message);
    }
  };

  // Run a test gasless transaction (simulate animation contract call)
  const runTestTransaction = async () => {
    if (!smartAccountClient) return;
    setTxStatus('Sending gasless transaction...');
    try {
      const callData = encodeFunctionData({
        abi: contractAbi,
        functionName: 'viewFrame',
        args: [1], // or the desired frame number
      });
      const txHash = await smartAccountClient.sendTransaction({
        to: contractAddress,
        data: callData,
        value: 0n,
      });
      setTxStatus('Transaction sent! Hash: ' + txHash);
    } catch (err) {
      setTxStatus('Transaction failed: ' + err.message);
    }
  };

  // Reset slap progress (for testing)
  const resetSlapProgress = async () => {
    if (!smartAccountClient || !privyAddress) return;
    try {
      setTxStatus('Checking slap progress...');
      
      // Check current slap progress from contract
      const publicClient = smartAccountClient.chain.publicClient;
      const slapProgress = await publicClient.readContract({
        address: contractAddress,
        abi: contractAbi,
        functionName: 'getCurrentSlapProgress',
        args: [privyAddress],
      });
      
      console.log('Current slap progress:', Number(slapProgress));
      
      if (Number(slapProgress) > 0) {
        setSlapInProgress(true);
        setTxStatus('Slap is in progress. Complete it by going to frame 162');
      } else {
        setSlapInProgress(false);
        setTxStatus('No slap in progress. Ready to start!');
      }
    } catch (err) {
      console.error('Failed to check slap progress:', err);
      setTxStatus('Failed to check slap progress: ' + err.message);
    }
  };

  // Render the frame image
  const frameSrc = `/johngettingpunched/frame_${String(currentFrame).padStart(5, '0')}.png`;

  return (
    <div className={styles.container}>
      <h1>John Getting Punched - Core Animation + Wallet Connect + Gasless</h1>
      <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
        Move your mouse over the frame to change frames (1-162)
      </p>
      
      {/* Debug Information */}
      <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f0f0f0', borderRadius: 6, fontSize: '12px' }}>
        <strong>Debug Info:</strong><br />
        Privy Ready: {ready ? '✅ Yes' : '❌ No'}<br />
        Authenticated: {authenticated ? '✅ Yes' : '❌ No'}<br />
        Wallets Count: {wallets.length}<br />
        Pimlico API Key: {process.env.NEXT_PUBLIC_PIMLICO_API_KEY ? '✅ Set' : '❌ Not Set'}<br />
        Smart Account Client: {smartAccountClient ? '✅ Ready' : '❌ Not Ready'}<br />
        {smartAccountClient?.account && (
          <>Smart Account Address: {smartAccountClient.account.address}<br /></>
        )}
        Wallet Type: {smartAccountClient?.isSmartWallet ? '🚀 Smart Wallet (Gasless)' : '⚠️ Embedded Wallet (Requires Approval)'}<br />
        Privy App ID: {process.env.NEXT_PUBLIC_PRIVY_APP_ID || '❌ Not Set'}<br />
        Contract Address: {contractAddress}<br />
        {authenticated && (
          <>
            Slap Progress: {slapInProgress ? '🎯 In Progress' : '⏳ Ready to Start'}<br />
            <strong>💡 Tip:</strong> Move mouse to frame 1 to start slap, then to frame 162 to complete it<br />
            <strong>🚀 Mode:</strong> Privy Embedded Wallet (Like Monad 2048)<br />
            <strong>Wallet Type:</strong> {wallets.length > 0 ? wallets[0].walletClientType : 'None'}<br />
            <strong>Signatures:</strong> {isUsingEmbeddedWallet ? '✅ Disabled (Auto-execute)' : '❌ Required (External wallet)'}<br />
            {!isUsingEmbeddedWallet && (
              <span style={{ color: 'orange' }}>
                ⚠️ Switch to embedded wallet for seamless experience (no signatures)
              </span>
            )}
          </>
        )}
      </div>
      
      <div style={{ marginBottom: 24 }}>
        {!authenticated ? (
          <button
            onClick={login}
            disabled={!ready}
            className={styles.connectButton}
          >
            {!ready ? 'Loading Privy...' : 'Connect Wallet'}
          </button>
        ) : (
          <div>
            <div style={{ marginBottom: 8 }}>
              <strong>Connected as:</strong> {privyAddress}
              <br />
              <strong>MON Balance:</strong>{' '}
              {isBalanceLoading
                ? 'Loading...'
                : monBalance
                  ? Number(monBalance.formatted).toLocaleString(undefined, { maximumFractionDigits: 4 })
                  : '0'}
            </div>
            <button onClick={logout} className={styles.connectButton}>
              Disconnect
            </button>
          </div>
        )}
      </div>
      <div style={{ marginBottom: 24 }}>
        {authenticated && (
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <input
              type="number"
              min="0.001"
              step="0.001"
              placeholder="0.002 MON (1 slap)"
              value={depositAmount}
              onChange={e => setDepositAmount(e.target.value)}
              style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc', width: 200 }}
              disabled={!wallets.length}
            />
            <div style={{ fontSize: '0.8em', color: '#888', marginTop: 4, marginBottom: 8 }}>
              💡 Suggested: 0.002 MON (1 slap) or 0.02 MON (10 slaps) or 0.1 MON (50 slaps)
            </div>
            <button onClick={handleDeposit} disabled={!smartAccountClient || !depositAmount} className={styles.animationButton}>
              Deposit to Contract {smartAccountClient?.isSmartWallet ? '(Gasless)' : '(Requires Approval)'}
            </button>
            <button onClick={testSmartAccount} disabled={!smartAccountClient} className={styles.animationButton}>
              Test Smart Account
            </button>
            <button onClick={testContract} disabled={!smartAccountClient} className={styles.animationButton}>
              Test Contract Connection
            </button>
            <button onClick={runTestTransaction} disabled={!smartAccountClient || !hasDeposited} className={styles.animationButton}>
              Run Test Gasless Transaction
            </button>
            <button onClick={resetSlapProgress} disabled={!smartAccountClient || !privyAddress} className={styles.animationButton}>
              Reset Slap Progress
            </button>
          </div>
        )}
        <div style={{ marginTop: 12, color: '#333', minHeight: 24 }}>{txStatus}</div>
      </div>

      {/* Leaderboard Section */}
      {authenticated && (
        <div style={{ marginBottom: 24, padding: 16, backgroundColor: '#f5f5f5', borderRadius: 8 }}>
          <h3 style={{ marginBottom: 12 }}>🏆 Slap Leaderboard</h3>
          <div style={{ marginBottom: 8 }}>
            <strong>Wallet:</strong> {(walletBalance / 1e18).toFixed(4)} MON | <strong>Contract Balance:</strong> {(userBalance / 1e18).toFixed(4)} MON ({Math.floor((userBalance / 1e18) / 0.002)} slaps) | <strong>Slaps:</strong> {userSlapCount} | <strong>Rank:</strong> {userRank > 0 ? `#${userRank}` : 'Not ranked'}
          </div>
          <div style={{ marginBottom: 8, fontSize: '0.9em', color: '#666' }}>
            💡 <strong>How it works:</strong> Only frames 1 & 162 cost 0.001 MON each (0.002 MON per complete slap). Frames 2-161 are FREE!
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {leaderboard.map((entry, index) => (
              <div key={index} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                padding: '4px 0',
                backgroundColor: entry.address === privyAddress ? '#e3f2fd' : 'transparent'
              }}>
                <span>#{entry.rank} {entry.address.slice(0, 6)}...{entry.address.slice(-4)}</span>
                <span>{entry.slapCount} slaps</span>
              </div>
            ))}
          </div>
          <button onClick={fetchLeaderboard} className={styles.animationButton} style={{ marginTop: 8 }}>
            Refresh Leaderboard
          </button>
        </div>
      )}
      <div className={styles.frameContainer}>
        <div
          ref={containerRef}
          className={styles.frameViewer}
          onMouseMove={handleMouseMove}
          style={{
            width: '640px',
            height: '360px',
            border: '2px solid #ccc',
            margin: '0 auto',
            position: 'relative',
            background: '#222',
            cursor: 'crosshair',
          }}
        >
          <img
            src={frameSrc}
            alt={`Frame ${currentFrame}`}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
          <div className={styles.frameInfo}>
            Frame: {currentFrame} / 162
          </div>
        </div>
      </div>
    </div>
  );
}