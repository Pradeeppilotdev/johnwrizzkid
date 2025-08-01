import { useState, useRef, useEffect, useCallback } from 'react';
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
  const [copyButtonText, setCopyButtonText] = useState('Copy');
  const [transactionNotifications, setTransactionNotifications] = useState([]);
  const [sessionPunchCount, setSessionPunchCount] = useState(0); // Frontend session counter
  const [showInstructions, setShowInstructions] = useState(false); // Instructions popup
  const [comicBubble, setComicBubble] = useState(null); // For comic speech bubbles
  const containerRef = useRef(null);

  // Safe Privy hooks with fallbacks
  let ready = false, authenticated = false, login = () => {}, logout = () => {}, user = null;
  let wallets = [];

  try {
    const privyHooks = usePrivy();
    const walletHooks = useWallets();
    ready = privyHooks.ready;
    authenticated = privyHooks.authenticated;
    login = privyHooks.login;
    logout = privyHooks.logout;
    user = privyHooks.user;
    wallets = walletHooks.wallets || [];
  } catch (error) {
    // Privy not available during SSR or build
    console.log('Privy not available:', error.message);
  }

  const privyAddress = wallets && wallets.length > 0 ? wallets[0].address : '';

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

      // Check if first time user and show instructions
      const hasSeenInstructions = localStorage.getItem('johnwrizzkid-instructions-seen');
      if (!hasSeenInstructions) {
        setShowInstructions(true);
      }
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

        // Add welcome notification
        addTransactionNotification('success', '🎉 Wallet Connected!', null);
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
  const testContractConnection = async () => {
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

      // Dynamic gas limit based on frame complexity
      let gasLimit;
      if (frameNumber === 162) {
        gasLimit = '0x7A120'; // 500,000 gas for Frame 162 (leaderboard updates, slap completion)
        console.log('🎯 Using high gas limit for Frame 162 completion');
      } else if (frameNumber === 1) {
        gasLimit = '0x30D40'; // 200,000 gas for Frame 1 (slap start)
        console.log('🥊 Using medium gas limit for Frame 1 start');
      } else {
        gasLimit = '0x186A0'; // 100,000 gas for other frames (shouldn't be used)
        console.log('⚡ Using standard gas limit for Frame', frameNumber);
      }

      // Prepare transaction parameters with reasonable gas prices
      const txParams = {
        to: contractAddress,
        data: viewFrameData,
        value: '0x0',
        nonce: '0x' + nonce.toString(16),
        gas: gasLimit,
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

      // Add transaction notification
      if (frameNumber === 1) {
        addTransactionNotification('success', '🥊 Punch Started!', txHash);
        setSlapInProgress(true);
        setTxStatus(`🥊 Punch started! 0.001 MON deducted. Continue to frame 162 to complete it.`);

        // Show comic bubble for punch start
        const startTexts = ['POW!!', 'WHAM!', 'KAPOW!', 'SMACK!'];
        const positions = ['left', 'right', 'inside'];
        const randomText = startTexts[Math.floor(Math.random() * startTexts.length)];
        const randomPosition = positions[Math.floor(Math.random() * positions.length)];
        setComicBubble({ text: randomText, type: 'start', position: randomPosition });
        setTimeout(() => setComicBubble(null), 2000);

      } else if (frameNumber === 162) {
        addTransactionNotification('success', '💥 Punch Completed!', txHash);
        setSlapInProgress(false);
        setSessionPunchCount(prev => prev + 1); // Increment session counter
        setTxStatus(`💥 Punch completed! 0.001 MON deducted. Check the leaderboard!`);

        // Show comic bubble for punch complete
        const completeTexts = ['BAM!!', 'BOOM!', 'WHOOSH!', 'CRASH!', 'ZAP!!'];
        const positions = ['left', 'right', 'inside'];
        const randomText = completeTexts[Math.floor(Math.random() * completeTexts.length)];
        const randomPosition = positions[Math.floor(Math.random() * positions.length)];
        setComicBubble({ text: randomText, type: 'complete', position: randomPosition });
        setTimeout(() => setComicBubble(null), 2000);

      } else {
        addTransactionNotification('success', `✅ Frame ${frameNumber} Viewed`, txHash);
        setTxStatus(`✅ Frame ${frameNumber} viewed! FREE - no MON deducted`);
      }

      // Update leaderboard and user data after transaction
      setTimeout(() => {
        fetchLeaderboard();
        fetchUserSlapCount();
      }, 2000);

    } catch (err) {
      console.error('Frame view transaction error:', err);

      // Add error notification
      addTransactionNotification('error', '❌ Transaction Failed', null);

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

  // Throttled frame update for better performance
  const frameUpdateRef = useRef(null);

  // Handle frame movement (mouse) with performance optimization
  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current) return;

    // Cancel previous frame update if still pending
    if (frameUpdateRef.current) {
      cancelAnimationFrame(frameUpdateRef.current);
    }

    // Use requestAnimationFrame for smooth updates
    frameUpdateRef.current = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width)); // Clamp between 0-1
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
    });
  }, [currentFrame]);

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

      // Add transaction notification
      addTransactionNotification('success', `💰 Deposited ${depositAmount} MON`, txHash);
      setTxStatus(`✅ Deposited ${depositAmount} MON gaslessly! Hash: ${txHash}`);

      // Refresh user data after successful deposit
      setTimeout(() => {
        fetchUserSlapCount();
      }, 2000);
    } catch (err) {
      console.error('Deposit error:', err);

      // Add error notification
      addTransactionNotification('error', '❌ Deposit Failed', null);

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
  const testGaslessTransaction = async () => {
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

  // Copy wallet address to clipboard
  const copyWalletAddress = async () => {
    if (privyAddress) {
      try {
        await navigator.clipboard.writeText(privyAddress);
        setCopyButtonText('Copied!');
        setTimeout(() => setCopyButtonText('Copy'), 2000);
      } catch (err) {
        console.error('Failed to copy address:', err);
        setCopyButtonText('Failed');
        setTimeout(() => setCopyButtonText('Copy'), 2000);
      }
    }
  };

  // Add transaction notification
  const addTransactionNotification = (type, title, hash) => {
    const notification = {
      id: Date.now(),
      type, // 'success' or 'error'
      title,
      hash,
      timestamp: Date.now()
    };

    setTransactionNotifications(prev => [notification, ...prev.slice(0, 2)]); // Keep max 3 notifications

    // Auto-remove after 10 seconds
    setTimeout(() => {
      setTransactionNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 10000);
  };

  // Close instructions and mark as seen
  const closeInstructions = () => {
    setShowInstructions(false);
    localStorage.setItem('johnwrizzkid-instructions-seen', 'true');
  };

  // Render the frame image
  const frameSrc = `/johngettingpunched/frame_${String(currentFrame).padStart(5, '0')}.png`;

  // Debug: Log the frame source
  console.log('Current frame source:', frameSrc);

  // Preload images for smoother animation
  useEffect(() => {
    const preloadImages = async () => {
      console.log('🔄 Preloading images for smoother animation...');
      const imagePromises = [];

      // Preload key frames first (1, 81, 162 for immediate responsiveness)
      const keyFrames = [1, 81, 162];
      for (const frame of keyFrames) {
        const img = new Image();
        const src = `/johngettingpunched/frame_${String(frame).padStart(5, '0')}.png`;
        imagePromises.push(new Promise((resolve, reject) => {
          img.onload = () => {
            console.log(`✅ Key frame ${frame} loaded`);
            resolve();
          };
          img.onerror = () => {
            console.error(`❌ Key frame ${frame} failed to load`);
            reject();
          };
          img.src = src;
        }));
      }

      // Wait for key frames to load
      try {
        await Promise.all(imagePromises);
        console.log('✅ Key frames preloaded successfully');

        // Then preload remaining frames in background (non-blocking)
        setTimeout(() => {
          for (let i = 1; i <= 162; i++) {
            if (!keyFrames.includes(i)) {
              const img = new Image();
              img.src = `/johngettingpunched/frame_${String(i).padStart(5, '0')}.png`;
            }
          }
          console.log('🔄 Background preloading all frames...');
        }, 1000);

      } catch (error) {
        console.error('❌ Some key frames failed to preload:', error);
      }
    };

    preloadImages();
  }, []);

  return (
    <div className={styles.container}>
      {!authenticated ? (
        <div className={styles.gameArea}>
          <div style={{ textAlign: 'center', maxWidth: '600px' }}>
            <h1 className={styles.logo} style={{ fontSize: '4rem', marginBottom: '2rem' }}>
              JohnWRizzKid
            </h1>
            <p style={{ fontSize: '1.3rem', marginBottom: '3rem', color: '#333', lineHeight: '1.6' }}>
              Experience the ultimate punch animation with <strong>blockchain transactions</strong>!<br/>
              Only frames 1 & 162 cost 0.001 MON each. Frames 2-161 are completely FREE!
            </p>
            <button onClick={login} className={styles.connectButton}>
              Connect Wallet & Play
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.logo}>JohnWRizzKid</div>
            <div className={styles.userInfo}>
              <div className={styles.balance}>
                <strong>Wallet:</strong> {(walletBalance / 1e18).toFixed(4)} MON
              </div>
              <div className={styles.balance}>
                <strong>Contract:</strong> {(userBalance / 1e18).toFixed(4)} MON
              </div>
              <button onClick={logout} className={styles.button} style={{
                padding: '0.5rem 1rem',
                fontSize: '0.9rem',
                background: '#4ecdc4',
                color: 'white',
                fontWeight: '600',
                border: '2px solid #2c2c2c',
                borderRadius: '15px'
              }}>
                Disconnect
              </button>
            </div>
          </div>

          {/* Clean Main Game Area */}
          <div className={styles.gameArea}>
            <div className={styles.gameContainer}>
              {/* Left Side - Controls */}
              <div className={styles.controlsPanel}>
                <h3>🎮 Controls</h3>

                {/* Wallet Display */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: '#666' }}>
                    Your Wallet:
                  </div>
                  <div style={{
                    background: '#f8f8f8',
                    border: '2px solid #2c2c2c',
                    borderRadius: '8px',
                    padding: '0.5rem',
                    fontSize: '0.8rem',
                    fontFamily: 'Monaco, monospace',
                    wordBreak: 'break-all',
                    marginBottom: '0.5rem'
                  }}>
                    {privyAddress}
                  </div>
                  <button
                    onClick={copyWalletAddress}
                    style={{
                      background: '#4ecdc4',
                      color: 'white',
                      border: '2px solid #2c2c2c',
                      borderRadius: '15px',
                      padding: '0.3rem 0.8rem',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    {copyButtonText}
                  </button>
                </div>

                {/* Deposit */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: '#666' }}>
                    Deposit MON:
                  </div>
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    placeholder="0.002"
                    value={depositAmount}
                    onChange={e => setDepositAmount(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.8rem',
                      border: '2px solid #2c2c2c',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      marginBottom: '0.5rem'
                    }}
                  />
                  <button
                    onClick={handleDeposit}
                    disabled={!smartAccountClient || !depositAmount}
                    style={{
                      width: '100%',
                      background: '#ff6b6b',
                      color: 'white',
                      border: '2px solid #2c2c2c',
                      borderRadius: '15px',
                      padding: '0.8rem',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    Deposit
                  </button>
                </div>

                {/* Frame Slider */}
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: '#666' }}>
                    Frame: {currentFrame}/162
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="162"
                    value={currentFrame}
                    onChange={(e) => setCurrentFrame(parseInt(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Center - Clean Square Frame */}
              <div className={styles.slapFrame}>
                {/* Session Punch Counter */}
                <div style={{
                  textAlign: 'center',
                  marginBottom: '1rem',
                  padding: '0.8rem',
                  background: '#f8f8f8',
                  border: '2px solid #2c2c2c',
                  borderRadius: '15px',
                  maxWidth: '300px',
                  margin: '0 auto 1rem auto'
                }}>
                  <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.3rem' }}>
                    Session Punches Completed
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: '700', color: '#ff6b6b' }}>
                    {sessionPunchCount}
                  </div>
                </div>

                <div
                  className={styles.frameContainer}
                  ref={containerRef}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={() => setCurrentFrame(1)}
                  style={{ position: 'relative' }}
                >
                  <img
                    src={frameSrc}
                    alt={`Frame ${currentFrame}`}
                    className={styles.frameImage}
                    onError={(e) => {
                      console.error('Image failed to load:', frameSrc);
                      console.error('Error details:', e);
                      // Try different fallback paths
                      if (!e.target.dataset.fallbackTried) {
                        e.target.dataset.fallbackTried = 'true';
                        e.target.src = '/johngettingpunched/frame_00001.png'; // Fallback
                      } else {
                        // If even fallback fails, show a placeholder
                        e.target.style.display = 'none';
                        console.error('All image fallbacks failed');
                      }
                    }}
                  />

                  {/* Comic Speech Bubble */}
                  {comicBubble && (
                    <div className={`${styles.comicBubble} ${styles[`comicBubble${comicBubble.position.charAt(0).toUpperCase() + comicBubble.position.slice(1)}`]} ${comicBubble.type === 'start' ? styles.punchStartBubble : styles.punchCompleteBubble}`}>
                      {comicBubble.text}
                    </div>
                  )}

                  <div className={styles.frameNumber}>
                    {currentFrame}
                  </div>
                </div>
              </div>

              {/* Right Side - Live Leaderboard */}
              <div className={styles.controlsPanel} style={{ transform: 'rotate(-1deg)' }}>
                <h3>🏆 Leaderboard</h3>

                {/* Small doodle instruction text */}
                <div style={{
                  fontSize: '0.6rem',
                  color: '#2c2c2c',
                  background: '#ffffff',
                  padding: '0.3rem 0.5rem',
                  borderRadius: '4px',
                  marginBottom: '0.8rem',
                  border: '1.5px dashed #2c2c2c',
                  fontFamily: 'Comic Sans MS, cursive, sans-serif',
                  transform: 'rotate(-0.5deg)',
                  boxShadow: '2px 2px 0px rgba(44, 44, 44, 0.2)'
                }}>
                  ✏️ To count: Frame 1 → Frame 162
                </div>

                {/* User Stats */}
                <div style={{
                  background: '#e8f5e8',
                  border: '2px solid #4ecdc4',
                  borderRadius: '8px',
                  padding: '0.8rem',
                  marginBottom: '1rem',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.3rem' }}>
                    Your Stats
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#4ecdc4' }}>
                    {userSlapCount} Punches
                  </div>
                  {userRank > 0 && (
                    <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.2rem' }}>
                      Rank #{userRank}
                    </div>
                  )}
                </div>

                {/* Real Leaderboard */}
                <div style={{
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {leaderboard.length > 0 ? (
                    leaderboard.map((entry, index) => (
                      <div
                        key={entry.address}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.5rem',
                          marginBottom: '0.5rem',
                          background: entry.address.toLowerCase() === privyAddress.toLowerCase() ? '#e8f5e8' : '#f8f9fa',
                          border: entry.address.toLowerCase() === privyAddress.toLowerCase() ? '2px solid #4ecdc4' : '2px solid #2c2c2c',
                          borderRadius: '8px',
                          fontSize: '0.8rem'
                        }}
                      >
                        <div style={{ fontWeight: '700', color: '#ff6b6b', minWidth: '30px' }}>
                          #{index + 1}
                        </div>
                        <div style={{
                          fontFamily: 'Monaco, monospace',
                          fontSize: '0.7rem',
                          flex: 1,
                          margin: '0 0.5rem'
                        }}>
                          {entry.address.slice(0, 6)}...{entry.address.slice(-4)}
                          {entry.address.toLowerCase() === privyAddress.toLowerCase() && (
                            <span style={{ color: '#4ecdc4', fontWeight: '600', marginLeft: '0.3rem' }}>
                              (You)
                            </span>
                          )}
                        </div>
                        <div style={{ fontWeight: '600', color: '#4ecdc4' }}>
                          {entry.slapCount}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{
                      textAlign: 'center',
                      padding: '2rem',
                      color: '#666',
                      fontStyle: 'italic'
                    }}>
                      Loading leaderboard...
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Doodle-Style Instructions Section Below Game */}
          <div style={{
            maxWidth: '1200px',
            margin: '3rem auto 2rem auto',
            padding: '0 2rem'
          }}>
            <div style={{
              background: '#ffffff',
              border: '4px dashed #2c2c2c',
              borderRadius: '25px',
              padding: '2.5rem',
              boxShadow: '12px 12px 0px rgba(44, 44, 44, 0.2), 6px 6px 0px rgba(255, 107, 107, 0.1)',
              transform: 'rotate(-1deg)',
              position: 'relative',
              fontFamily: 'Comic Sans MS, cursive, sans-serif'
            }}>
              {/* Doodle decorations */}
              <div style={{
                position: 'absolute',
                top: '-10px',
                left: '20px',
                width: '30px',
                height: '30px',
                border: '3px solid #ff6b6b',
                borderRadius: '50%',
                transform: 'rotate(15deg)'
              }}></div>
              <div style={{
                position: 'absolute',
                top: '10px',
                right: '30px',
                width: '20px',
                height: '20px',
                border: '2px solid #4ecdc4',
                transform: 'rotate(-20deg)'
              }}></div>
              <div style={{
                position: 'absolute',
                bottom: '15px',
                left: '50px',
                fontSize: '2rem',
                color: '#ff6b6b',
                opacity: 0.3,
                transform: 'rotate(-15deg)'
              }}>★</div>

              <h2 style={{
                color: '#070707c7',
                fontSize: '2.2rem',
                marginBottom: '2rem',
                textAlign: 'center',
                fontFamily: 'Comic Sans MS, cursive, sans-serif',
                textShadow: '3px 3px 0px rgba(11, 11, 11, 0.24)',
                transform: 'rotate(1deg)'
              }}>
                How to Play JohnWRizzKid!
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
                <div style={{
                  background: '#f8f9fa',
                  border: '3px solid #2c2c2c',
                  borderRadius: '15px',
                  padding: '1.5rem',
                  transform: 'rotate(0.5deg)',
                  boxShadow: '4px 4px 0px rgba(44, 44, 44, 0.1)'
                }}>
                  <h3 style={{
                    color: '#4ecdc4',
                    fontSize: '1.3rem',
                    marginBottom: '1rem',
                    fontFamily: 'Comic Sans MS, cursive, sans-serif',
                    textDecoration: 'underline',
                    textDecorationStyle: 'wavy'
                  }}>
                     Step 1: Fund Your Wallet
                  </h3>
                  <div style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
                    <p style={{ color: '#333', marginBottom: '0.7rem', position: 'relative' }}>
                      <span style={{ color: '#ff6b6b', fontWeight: 'bold' }}>→</span> Copy your wallet address using the "Copy" button
                    </p>
                    <p style={{ color: '#333', marginBottom: '0.7rem' }}>
                      <span style={{ color: '#ff6b6b', fontWeight: 'bold' }}>→</span> Get MON tokens and send them to your wallet address
                    </p>
                    <p style={{ color: '#333' }}>
                      <span style={{ color: '#ff6b6b', fontWeight: 'bold' }}>→</span> Enter desired amount and click "Deposit" to fund the contract
                    </p>
                  </div>
                </div>

                <div style={{
                  background: '#f8f9fa',
                  border: '3px solid #2c2c2c',
                  borderRadius: '15px',
                  padding: '1.5rem',
                  transform: 'rotate(-0.8deg)',
                  boxShadow: '4px 4px 0px rgba(44, 44, 44, 0.1)'
                }}>
                  <h3 style={{
                    color: '#4ecdc4',
                    fontSize: '1.3rem',
                    marginBottom: '1rem',
                    fontFamily: 'Comic Sans MS, cursive, sans-serif',
                    textDecoration: 'underline',
                    textDecorationStyle: 'wavy'
                  }}>
                     Step 2: Navigate Frames
                  </h3>
                  <div style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
                    <p style={{ color: '#333', marginBottom: '0.7rem' }}>
                      <span style={{ color: '#ff6b6b', fontWeight: 'bold' }}>→</span> Move your cursor across the frame to control animation
                    </p>
                    <p style={{ color: '#333', marginBottom: '0.7rem' }}>
                      <span style={{ color: '#ff6b6b', fontWeight: 'bold' }}>→</span> Left side = Frame 1, Right side = Frame 162
                    </p>
                    <p style={{ color: '#333' }}>
                      <span style={{ color: '#ff6b6b', fontWeight: 'bold' }}>→</span> Use the slider below for precise frame control
                    </p>
                  </div>
                </div>

                <div style={{
                  background: '#f8f9fa',
                  border: '3px solid #2c2c2c',
                  borderRadius: '15px',
                  padding: '1.5rem',
                  transform: 'rotate(0.3deg)',
                  boxShadow: '4px 4px 0px rgba(44, 44, 44, 0.1)'
                }}>
                  <h3 style={{
                    color: '#4ecdc4',
                    fontSize: '1.3rem',
                    marginBottom: '1rem',
                    fontFamily: 'Comic Sans MS, cursive, sans-serif',
                    textDecoration: 'underline',
                    textDecorationStyle: 'wavy'
                  }}>
                     Step 3: Smart Transactions
                  </h3>
                  <div style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
                    <p style={{ color: '#333', marginBottom: '0.7rem' }}>
                      <span style={{ color: '#ff6b6b', fontWeight: 'bold' }}>→</span> Only Frames 1 & 162 cost MON (0.001 each)
                    </p>
                    <p style={{ color: '#333', marginBottom: '0.7rem' }}>
                      <span style={{ color: '#ff6b6b', fontWeight: 'bold' }}>→</span> Frames 2-161 are completely FREE!
                    </p>
                    <p style={{ color: '#333' }}>
                      <span style={{ color: '#ff6b6b', fontWeight: 'bold' }}>→</span> Efficient blockchain transactions for the best experience!
                    </p>
                  </div>
                </div>

                <div style={{
                  gridColumn: '1 / -1',
                  padding: '1.5rem',
                  background: '#fff3cd',
                  border: '3px dashed #ffc107',
                  borderRadius: '20px',
                  marginTop: '1rem',
                  transform: 'rotate(-0.3deg)',
                  boxShadow: '6px 6px 0px rgba(255, 193, 7, 0.2)',
                  position: 'relative'
                }}>
                  {/* Warning doodle decoration */}
                  <div style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '20px',
                    fontSize: '1.5rem',
                    transform: 'rotate(20deg)'
                  }}>⚠️</div>

                  <h3 style={{
                    color: '#856404',
                    fontSize: '1.4rem',
                    marginBottom: '1rem',
                    fontFamily: 'Comic Sans MS, cursive, sans-serif',
                    textAlign: 'center'
                  }}>
                    🎯 Important: How Punches Count On-Chain! 🎯
                  </h3>
                  <p style={{
                    color: '#856404',
                    marginBottom: '1rem',
                    fontWeight: '700',
                    fontSize: '1rem',
                    textAlign: 'center'
                  }}>
                    To record a punch on the blockchain:
                  </p>
                  <div style={{
                    display: 'flex',
                    gap: '2rem',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}>
                    <div style={{
                      background: '#ffffff',
                      border: '2px solid #856404',
                      borderRadius: '10px',
                      padding: '0.8rem',
                      transform: 'rotate(1deg)'
                    }}>
                      <p style={{ color: '#856404', margin: 0, fontSize: '0.9rem', fontWeight: '600' }}>
                        1. <strong>Start at Frame 1</strong><br/>This begins your punch
                      </p>
                    </div>
                    <div style={{
                      background: '#ffffff',
                      border: '2px solid #856404',
                      borderRadius: '10px',
                      padding: '0.8rem',
                      transform: 'rotate(-1deg)'
                    }}>
                      <p style={{ color: '#856404', margin: 0, fontSize: '0.9rem', fontWeight: '600' }}>
                        2. <strong>Move through frames</strong><br/>Navigate to Frame 162
                      </p>
                    </div>
                    <div style={{
                      background: '#ffffff',
                      border: '2px solid #856404',
                      borderRadius: '10px',
                      padding: '0.8rem',
                      transform: 'rotate(0.5deg)'
                    }}>
                      <p style={{ color: '#856404', margin: 0, fontSize: '0.9rem', fontWeight: '600' }}>
                        3. <strong>Complete at Frame 162</strong><br/>This records your punch!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Low Balance Warning */}
          {authenticated && (userBalance < 0.1 || walletBalance < 0.1) && (
            <div style={{
              position: 'fixed',
              bottom: '20px',
              right: '20px',
              background: '#ff6b6b',
              color: 'white',
              padding: '1rem 1.5rem',
              borderRadius: '15px',
              border: '3px solid #2c2c2c',
              boxShadow: '4px 4px 0px rgba(44, 44, 44, 0.3)',
              zIndex: 1000,
              maxWidth: '300px',
              fontFamily: 'Comic Sans MS, cursive, sans-serif'
            }}>
              <div style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                ⚠️ Low Balance Warning!
              </div>
              <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                {userBalance < 0.1 && walletBalance < 0.1 ? (
                  <>Both your wallet and contract balance are low!</>
                ) : userBalance < 0.1 ? (
                  <>Your contract balance is low! Please deposit more MON.</>
                ) : (
                  <>Your wallet balance is low! Please add more MON to your wallet.</>
                )}
              </div>
              <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                {userBalance < 0.1 && `Contract: ${userBalance.toFixed(4)} MON`}
                {userBalance < 0.1 && walletBalance < 0.1 && ' | '}
                {walletBalance < 0.1 && `Wallet: ${(walletBalance / 1e18).toFixed(4)} MON`}
              </div>
            </div>
          )}

          {/* Instructions Popup for First-Time Users */}
          {showInstructions && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '2rem'
            }}>
              <div style={{
                background: 'white',
                border: '3px solid #2c2c2c',
                borderRadius: '20px',
                padding: '2rem',
                maxWidth: '600px',
                maxHeight: '80vh',
                overflowY: 'auto',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                // Custom scrollbar styling to maintain rounded corners
                scrollbarWidth: 'thin',
                scrollbarColor: '#4ecdc4 transparent'
              }}
              // Add webkit scrollbar styles for better browser support
              className="custom-scrollbar"
              >
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <h2 style={{ color: '#ff6b6b', fontSize: '2rem', marginBottom: '0.5rem' }}>
                    🎮 How to Play JohnWRizzKid!
                  </h2>
                  <p style={{ color: '#666', fontSize: '1rem' }}>
                    Welcome! Here's everything you need to know:
                  </p>
                </div>

                <div style={{ textAlign: 'left', lineHeight: '1.6' }}>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ color: '#4ecdc4', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                      💰 Step 1: Fund Your Wallet
                    </h3>
                    <p style={{ color: '#333', marginBottom: '0.5rem' }}>
                      • Copy your wallet address using the "Copy" button
                    </p>
                    <p style={{ color: '#333', marginBottom: '0.5rem' }}>
                      • Get MON tokens and send them to your wallet address
                    </p>
                    <p style={{ color: '#333' }}>
                      • Enter desired amount and click "Deposit" to fund the contract
                    </p>
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ color: '#4ecdc4', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                      🎯 Step 2: Play the Game
                    </h3>
                    <p style={{ color: '#333', marginBottom: '0.5rem' }}>
                      • Move your cursor over John's image to control the animation
                    </p>
                    <p style={{ color: '#333', marginBottom: '0.5rem' }}>
                      • Left side = Frame 1, Right side = Frame 162
                    </p>
                    <p style={{ color: '#333' }}>
                      • Complete a punch: Frame 1 → Frame 162 (costs 0.002 MON total)
                    </p>
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ color: '#4ecdc4', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                      ⚡ Step 3: Smart Transactions
                    </h3>
                    <p style={{ color: '#333', marginBottom: '0.5rem' }}>
                      • Only Frames 1 & 162 cost MON (0.001 each)
                    </p>
                    <p style={{ color: '#333', marginBottom: '0.5rem' }}>
                      • Frames 2-161 are completely FREE!
                    </p>
                    <p style={{ color: '#333' }}>
                      • Efficient blockchain transactions for the best experience!
                    </p>
                  </div>

                  <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#fff3cd', border: '2px solid #ffc107', borderRadius: '8px' }}>
                    <h3 style={{ color: '#856404', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                      🎯 Important: How Punches Count On-Chain
                    </h3>
                    <p style={{ color: '#856404', marginBottom: '0.5rem', fontWeight: '600' }}>
                      To record a punch on the blockchain:
                    </p>
                    <p style={{ color: '#856404', marginBottom: '0.3rem' }}>
                      1. <strong>Start at Frame 1</strong> - This begins your punch
                    </p>
                    <p style={{ color: '#856404', marginBottom: '0.3rem' }}>
                      2. <strong>Move through frames</strong> - Navigate to Frame 162
                    </p>
                    <p style={{ color: '#856404' }}>
                      3. <strong>Complete at Frame 162</strong> - This records your punch!
                    </p>
                  </div>

                  <div style={{
                    background: '#f8f8f8',
                    border: '2px solid #4ecdc4',
                    borderRadius: '10px',
                    padding: '1rem',
                    marginBottom: '1.5rem'
                  }}>
                    <p style={{ color: '#333', margin: 0, fontSize: '0.9rem', textAlign: 'center' }}>
                      💡 <strong>Pro Tip:</strong> Watch your session punch counter above the frame!
                    </p>
                  </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <button
                    onClick={closeInstructions}
                    style={{
                      background: '#ff6b6b',
                      color: 'white',
                      border: '2px solid #2c2c2c',
                      borderRadius: '15px',
                      padding: '1rem 2rem',
                      fontSize: '1.1rem',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    🚀 Got It! Let's Play!
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Transaction Notifications - Right Side */}
          <div className={styles.transactionNotifications}>
            {transactionNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`${styles.transactionNotification} ${styles[notification.type]}`}
              >
                <div className={styles.transactionTitle}>
                  {notification.title}
                </div>
                {notification.hash && (
                  <>
                    <div className={styles.transactionHash}>
                      {notification.hash.slice(0, 10)}...{notification.hash.slice(-8)}
                    </div>
                    <a
                      href={`https://testnet.monadexplorer.com/tx/${notification.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.explorerLink}
                    >
                      View on Explorer
                    </a>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}



    </div>
  );
}