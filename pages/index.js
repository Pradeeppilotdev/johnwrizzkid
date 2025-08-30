import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import styles from '../styles/Home.module.css';
import { usePrivy, useWallets, useCrossAppAccounts } from '@privy-io/react-auth';
import { encodeFunctionData, createPublicClient, createWalletClient, http, formatUnits, parseEther, parseGwei, custom } from 'viem';
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
  const contractAddress = '0x2a2B24C36ee4734cd657c05c0B810f7adb38fb90'; // New SimpleFrameViewer contract

// Optional airdrop/dripper contract for first-time users
const airdropContractAddress = process.env.NEXT_PUBLIC_AIRDROP_CONTRACT_ADDRESS || '';
const airdropAbi = [
    {
        inputs: [],
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
];
// Alternate common naming for native faucets
const airdropAbiAlt = [
    {
        inputs: [],
        name: 'claim',
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
];

export default function Home() {
  const [currentFrame, setCurrentFrame] = useState(1);
  const [smartAccountClient, setSmartAccountClient] = useState(null);
  const [txStatus, setTxStatus] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [hasDeposited, setHasDeposited] = useState(false);
  const [isGameRegistered, setIsGameRegistered] = useState(true);
  const [enableAutoDeposit, setEnableAutoDeposit] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [globalLeaderboard, setGlobalLeaderboard] = useState([]);
  const [userSlapCount, setUserSlapCount] = useState(0);
  const [userRank, setUserRank] = useState(0);
  const [userBalance, setUserBalance] = useState(0n); // Contract balance in wei
  const [walletBalance, setWalletBalance] = useState(0n); // Native wallet balance in wei

  // Derived balances in MON for display and comparisons
  const walletBalanceMon = useMemo(() => {
    try {
      return Number(formatUnits(BigInt(walletBalance || 0n), 18));
    } catch {
      return 0;
    }
  }, [walletBalance]);

  const userBalanceMon = useMemo(() => {
    try {
      return Number(formatUnits(BigInt(userBalance || 0n), 18));
    } catch {
      return 0;
    }
  }, [userBalance]);
  const [slapInProgress, setSlapInProgress] = useState(false);
  const [copyButtonText, setCopyButtonText] = useState('Copy');
  const [transactionNotifications, setTransactionNotifications] = useState([]);
  const [sessionPunchCount, setSessionPunchCount] = useState(0); // Frontend session counter
  const [showInstructions, setShowInstructions] = useState(false); // Instructions popup
  const [comicBubble, setComicBubble] = useState(null); // For comic speech bubbles
  const containerRef = useRef(null);
  const [hasAttemptedAirdrop, setHasAttemptedAirdrop] = useState(false);

  // Safe Privy hooks with fallbacks
  let ready = false, authenticated = false, login = () => {}, logout = () => {}, user = null;
  let wallets = [];
  let monadGamesWalletAddress = '';
  let loginWithCrossAppAccount = null;
  let linkCrossAppAccount = null;
  let crossAppSendTransaction = null;

  try {
    const privyHooks = usePrivy();
    const walletHooks = useWallets();
    try {
      const crossAppHooks = useCrossAppAccounts();
      loginWithCrossAppAccount = crossAppHooks?.loginWithCrossAppAccount || null;
      linkCrossAppAccount = crossAppHooks?.linkCrossAppAccount || null;
      crossAppSendTransaction = crossAppHooks?.sendTransaction || null;
    } catch {}
    ready = privyHooks.ready;
    authenticated = privyHooks.authenticated;
    login = privyHooks.login;
    logout = privyHooks.logout;
    user = privyHooks.user;
    // Prefer in-app embedded wallet API for one-click
    var privySendTransaction = privyHooks?.sendTransaction;
    wallets = walletHooks.wallets || [];
    // Prefer Monad Games ID cross-app embedded wallet if linked
    if (authenticated && user && user.linkedAccounts && user.linkedAccounts.length > 0) {
      try {
        const crossAppAccount = user.linkedAccounts.find(
          (account) => account.type === 'cross_app' && account.providerApp && account.providerApp.id === (process.env.NEXT_PUBLIC_MONAD_GAMES_CROSS_APP_ID || 'cmd8euall0037le0my79qpz42')
        );
        if (crossAppAccount && crossAppAccount.embeddedWallets && crossAppAccount.embeddedWallets.length > 0) {
          monadGamesWalletAddress = crossAppAccount.embeddedWallets[0].address;
        }
      } catch (e) {
        console.log('Cross-app account parse failed:', e.message);
      }
    }
  } catch (error) {
    // Privy not available during SSR or build
    console.log('Privy not available:', error.message);
  }

  // Addresses
  // monadGamesWalletAddress: MGID identity wallet (for username and global leaderboard submission)
  // appEmbeddedAddress: your app's embedded wallet (for one-click tx on in-game contract)
  const appEmbeddedWallet = (wallets || []).find((w) => w.walletClientType === 'privy');
  const appEmbeddedAddress = appEmbeddedWallet?.address || '';
  const privyAddress = monadGamesWalletAddress || '';

  // Balances for display and low-balance prompts
  const [mgidBalanceMon, setMgidBalanceMon] = useState(null);
  const [embeddedBalanceMon, setEmbeddedBalanceMon] = useState(null);

  const [username, setUsername] = useState('');

  // Monad 2048 approach: Local nonce management and direct RPC
  const userNonce = useRef(0);
  const walletClient = useRef(null);
  const isAutoDepositing = useRef(false);
  const selectedWalletAddress = useRef(null);
  const linkAttemptedRef = useRef(false);

  // Remove wagmi useBalance and useAccount for now to avoid errors
  // We'll implement balance fetching manually using viem
  const [monBalance, setMonBalance] = useState(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);

  // Switch wallet to Monad Testnet after connection
  useEffect(() => {
    if (wallets.length > 0 && privyAddress) {
      (async () => {
        try {
          const target = wallets.find(w => w.address?.toLowerCase() === privyAddress.toLowerCase());
          if (target) {
            // Explicitly set it active before switching chain
            if (target.setActiveWallet) {
              try { await target.setActiveWallet(); } catch {}
            }
            await target.switchChain(monadTestnet.id);
          }
        } catch {}
      })();

      // Check if first time user and show instructions (desktop only)
      const hasSeenInstructions = localStorage.getItem('johnwrizzkid-instructions-seen');
      const isMobile = window.innerWidth <= 768;
      if (!hasSeenInstructions && !isMobile) {
        setShowInstructions(true);
      }


    }
  }, [wallets, privyAddress]);

  // Ensure app embedded wallet is also on Monad Testnet
  useEffect(() => {
    if (appEmbeddedWallet && typeof appEmbeddedWallet.switchChain === 'function') {
      (async () => {
        try {
          await appEmbeddedWallet.switchChain(monadTestnet.id);
        } catch {}
      })();
    }
  }, [appEmbeddedWallet]);

  // Fetch Monad Games ID username for the selected wallet
  useEffect(() => {
    const fetchUsername = async () => {
      const targetAddr = monadGamesWalletAddress || privyAddress;
      if (!targetAddr) return;
      try {
        const resp = await fetch(`https://monad-games-id-site.vercel.app/api/check-wallet?wallet=${targetAddr}`);
        if (!resp.ok) return;
        const data = await resp.json();
        if (data && data.hasUsername && data.user && data.user.username) {
          setUsername(data.user.username);
        } else {
          setUsername('');
        }
      } catch (e) {
        setUsername('');
      }
    };
    fetchUsername();
  }, [privyAddress]);

  // Check game registration status
  useEffect(() => {
    if (privyAddress) {
      checkGameRegistration();
    }
  }, [privyAddress]);

  // Fetch balances for both MGID wallet and embedded wallet
  useEffect(() => {
    const fetchBalances = async () => {
      if (!authenticated || !privyAddress || !appEmbeddedAddress) return;
      
      try {
        const { createPublicClient, http } = await import('viem');
        const publicClient = createPublicClient({
          chain: { id: 10143, name: 'Monad Testnet' },
          transport: http('https://testnet-rpc.monad.xyz/'),
        });

        // Fetch MGID wallet balance
        const mgidBalance = await publicClient.getBalance({ address: privyAddress });
        setMgidBalanceMon(Number(formatUnits(mgidBalance, 18)));

        // Fetch embedded wallet balance
        const embeddedBalance = await publicClient.getBalance({ address: appEmbeddedAddress });
        setEmbeddedBalanceMon(Number(formatUnits(embeddedBalance, 18)));

        console.log('💰 Balances updated:', {
          mgid: Number(formatUnits(mgidBalance, 18)),
          embedded: Number(formatUnits(embeddedBalance, 18))
        });
      } catch (error) {
        console.error('Failed to fetch balances:', error);
      }
    };

    fetchBalances();
    
    // Set up interval to refresh balances every 30 seconds
    const interval = setInterval(fetchBalances, 30000);
    return () => clearInterval(interval);
  }, [authenticated, privyAddress, appEmbeddedAddress]);

  // Check if using embedded wallet (this is what we want for no signatures)
  const isUsingEmbeddedWallet = wallets.length > 0 && wallets[0].walletClientType === 'privy';
  
  // Monad 2048 approach: Setup wallet client and nonce management
  useEffect(() => {
    async function setupWalletClient() {
      console.log('🔍 setupWalletClient called');
      console.log('🔍 ready:', ready);
      console.log('🔍 wallets.length:', wallets.length);
      console.log('🔍 privyAddress:', privyAddress);
      console.log('🔍 wallets:', wallets.map(w => ({ address: w.address, type: w.walletClientType })));
      
      // Do not require wallets array; we can build provider directly from cross-app linked account
      if (!ready || !authenticated || !user || !privyAddress) {
        console.log('❌ setupWalletClient early return');
        return;
      }

      try {
        setTxStatus('🔄 Setting up Privy embedded wallet (Monad 2048 approach)...');

        // Use the exact logic from Notion docs to get the Monad Games ID cross-app embedded wallet
        let targetWallet = null;
        
        console.log('🔍 Checking user.linkedAccounts:', user?.linkedAccounts);
        
        if (authenticated && user && user.linkedAccounts && user.linkedAccounts.length > 0) {
          // Get the cross app account created using Monad Games ID
          const crossAppAccount = user.linkedAccounts.find(
            account => account.type === 'cross_app' && 
            account.providerApp && 
            account.providerApp.id === (process.env.NEXT_PUBLIC_MONAD_GAMES_CROSS_APP_ID || 'cmd8euall0037le0my79qpz42')
          );
          
          console.log('🔍 Cross app account found:', crossAppAccount);
          console.log('🔍 Cross app account embedded wallets:', crossAppAccount?.embeddedWallets);
          
          if (crossAppAccount && crossAppAccount.embeddedWallets && crossAppAccount.embeddedWallets.length > 0) {
            // The first embedded wallet created using Monad Games ID is the wallet address
            const monadGamesWallet = crossAppAccount.embeddedWallets[0];
            console.log('🔍 Found Monad Games ID cross-app wallet:', monadGamesWallet.address);
            
            // CRITICAL FIX: Instead of looking in wallets array, use the cross-app wallet directly
            // This bypasses Privy's wallet selection issue
            if (monadGamesWallet.getEthereumProvider) {
              console.log('✅ Using Monad Games ID cross-app wallet directly');
              targetWallet = {
                address: monadGamesWallet.address,
                walletClientType: 'cross_app_monad',
                getEthereumProvider: monadGamesWallet.getEthereumProvider.bind(monadGamesWallet),
                // Add any other methods the wallet might need
                setActiveWallet: async () => {
                  console.log('✅ Cross-app wallet activated');
                }
              };
            } else {
              console.log('❌ Cross-app wallet missing getEthereumProvider method');
              // Try to find a matching wallet object in wallets[] by address
              const matchingWallet = wallets.find(
                (w) => (w.address || '').toLowerCase() === (monadGamesWallet.address || '').toLowerCase()
              );
              if (matchingWallet && matchingWallet.getEthereumProvider) {
                console.log('✅ Using matching wallet from wallets array');
                targetWallet = matchingWallet;
              } else {
                console.log('❌ Matching wallet not in wallets array or missing provider');
                // Attempt to link the cross-app account so provider methods hydrate
                // If user is already logged in, Privy suggests using link helper instead of login
                if (linkCrossAppAccount && !linkAttemptedRef.current) {
                  try {
                    linkAttemptedRef.current = true;
                    setTxStatus('🔗 Linking Monad Games ID wallet...');
                    await linkCrossAppAccount({ appId: process.env.NEXT_PUBLIC_MONAD_GAMES_CROSS_APP_ID || 'cmd8euall0037le0my79qpz42' });
                    console.log('🔁 Link initiated. Reloading to hydrate provider...');
                    window.location.reload();
                    return;
                  } catch (e) {
                    const msg = e?.message || String(e);
                    console.log('⚠️ Cross-app link failed:', msg);
                    if (msg.includes('Invalid connected app')) {
                      setTxStatus('❌ Invalid connected app. In Privy Dashboard, enable the Connected App with ID ' + (process.env.NEXT_PUBLIC_MONAD_GAMES_CROSS_APP_ID || 'cmd8euall0037le0my79qpz42'));
                    }
                  }
                }
              }
            }
          } else {
            console.log('❌ No cross-app account or embedded wallets found');
          }
        } else {
          console.log('❌ No linked accounts found');
        }
        
        // If cross-app wallet (or matching wallet) found, build provider directly
        if (targetWallet && targetWallet.getEthereumProvider) {
          const ethereumProvider = await targetWallet.getEthereumProvider();
        const provider = {
          request: ethereumProvider.request.bind(ethereumProvider),
          signTransaction: async (txParams) => {
            return await ethereumProvider.request({
              method: 'eth_signTransaction',
              params: [txParams],
            });
          }
        };
          walletClient.current = provider;
          selectedWalletAddress.current = privyAddress;
          console.log('✅ walletClient.current set from cross-app provider');
        }
        
        // Do NOT fallback to other wallets; require Monad Games ID wallet to avoid mismatches
        
        if (!targetWallet) {
          console.log('❌ No wallet available');
          setTxStatus('❌ No wallet available. Please reconnect.');
          return;
        }
        
        const userWallet = targetWallet;
        console.log('🔍 Using wallet:', userWallet.address);
        console.log('🔍 Wallet type:', userWallet.walletClientType);
        
        if (!userWallet) {
          console.log('❌ No wallet available');
          return;
        }

        // CRITICAL: Force Privy to use this specific wallet for all transactions
        // This ensures the transaction modal shows the correct wallet
        try {
          // Set this wallet as the active wallet in Privy
          if (userWallet.setActiveWallet) {
            await userWallet.setActiveWallet();
            console.log('✅ Set wallet as active in Privy:', userWallet.address);
          }
        } catch (error) {
          console.log('⚠️ Could not set active wallet (this is okay):', error.message);
        }

        // If walletClient already set from cross-app provider above, skip rebuilding
        if (!walletClient.current) {
          const ethereumProvider = await userWallet.getEthereumProvider();
          const provider = {
            request: ethereumProvider.request.bind(ethereumProvider),
            signTransaction: async (txParams) => {
              return await ethereumProvider.request({
                method: 'eth_signTransaction',
                params: [txParams],
              });
            }
          };
        walletClient.current = provider;
          console.log('✅ walletClient.current set to:', provider);
        }
        
        // Store the selected wallet address for verification
        selectedWalletAddress.current = privyAddress;

        // Fetch current nonce from network
        const publicClient = createPublicClient({
          chain: monadTestnet,
          transport: http('https://testnet-rpc.monad.xyz/'),
        });

        const nonce = await publicClient.getTransactionCount({
          address: userWallet.address,
        });
        userNonce.current = nonce;

        console.log('✅ Wallet client ready:', userWallet.address);
        console.log('✅ Starting nonce:', nonce);

        setSmartAccountClient({
          account: { address: userWallet.address },
          wallet: userWallet,
          isSmartWallet: false, // Using direct Privy wallet like Monad 2048
          walletClient: provider
        });

        // Add welcome notification
        addTransactionNotification('success', '🎉 Wallet Connected!', null);
        setTxStatus('✅ Privy embedded wallet ready! Gasless transactions enabled (Monad 2048 approach)');

        // Attempt first-time airdrop (once per session) if configured
        if (!hasAttemptedAirdrop && airdropContractAddress) {
          setTimeout(() => tryFirstTimeAirdrop(), 2000); // Small delay to ensure everything is ready
        }
      } catch (error) {
        console.error('❌ Failed to setup wallet client:', error);
        setTxStatus('❌ Wallet setup failed: ' + error.message);
      }
    }

    setupWalletClient();
  }, [user, ready, wallets]);

  // Periodically fetch balances for MGID and embedded wallet
  useEffect(() => {
    let cancelled = false;
    const fetchBalances = async () => {
      try {
        const client = createPublicClient({ chain: monadTestnet, transport: http('https://testnet-rpc.monad.xyz/') });
        if (privyAddress) {
          const bal = await client.getBalance({ address: privyAddress });
          if (!cancelled) setMgidBalanceMon(Number(formatUnits(bal, 18)).toFixed(4));
        }
        if (appEmbeddedAddress) {
          const balE = await client.getBalance({ address: appEmbeddedAddress });
          if (!cancelled) setEmbeddedBalanceMon(Number(formatUnits(balE, 18)).toFixed(4));
        }
      } catch {}
    };
    fetchBalances();
    const id = setInterval(fetchBalances, 10000);
    return () => { cancelled = true; clearInterval(id); };
  }, [privyAddress, appEmbeddedAddress]);

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
      const code = await publicClient.getBytecode({ address: gameContractAddress });
      if (code) {
        console.log('Contract is deployed at:', gameContractAddress);
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
        setTxStatus('Contract not found at address: ' + gameContractAddress);
      }
    } catch (err) {
      console.error('Contract test error:', err);
      setTxStatus('Contract test failed: ' + err.message);
    }
  };

  // Fetch leaderboard data from backend API
  const isFetchingLeaderboardRef = useRef(false);
  const fetchLeaderboard = async (forceRefresh = false) => {
    if (!wallets.length) return;
    if (isFetchingLeaderboardRef.current) return;
    try {
      isFetchingLeaderboardRef.current = true;
      console.log('🔄 Fetching leaderboard from backend...');
      
      // Call the backend API
      const response = await fetch(`/api/leaderboard?userAddress=${privyAddress}`);
      const data = await response.json();
      
      if (response.ok) {
        // Format for the UI
        const formattedLeaderboard = data.top10.map(entry => ({
          address: entry.address,
          slapCount: entry.slapCount,
          rank: entry.rank,
        }));

        console.log('📊 Leaderboard updated:', formattedLeaderboard);
        console.log('👤 User rank:', data.userRank);
        setLeaderboard(formattedLeaderboard);
        setUserRank(data.userRank);
        // Fetch global leaderboard in parallel (non-blocking UI)
        fetch('/api/leaderboard/simple')
          .then(r => r.ok ? r.json() : null)
          .then(j => setGlobalLeaderboard(j?.top || []))
          .catch(() => {});
      } else {
        console.error('Failed to fetch leaderboard:', data.error);
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    } finally {
      isFetchingLeaderboardRef.current = false;
    }
  };

  // Fetch user's slap count and rank using embedded wallet
  const fetchUserSlapCount = async () => {
    if (!wallets.length || !appEmbeddedAddress) return;
    try {
      console.log('👤 Fetching user data for:', appEmbeddedAddress);
      // Create a simple public client for reading
      const { createPublicClient, http } = await import('viem');
      const publicClient = createPublicClient({
        chain: { id: 10143, name: 'Monad Testnet' },
        transport: http('https://testnet-rpc.monad.xyz/'),
      });

      // Fetch contract balance and wallet balance
      const [contractBalance, nativeBalance] = await Promise.all([
        publicClient.readContract({
          address: contractAddress,
          abi: contractAbi,
          functionName: 'getBalance',
          args: [appEmbeddedAddress],
        }),
        publicClient.getBalance({
          address: appEmbeddedAddress,
        }),
      ]);

      const previousWalletBalance = walletBalance;
      const newWalletBalance = nativeBalance; // bigint from viem
      const newContractBalance = contractBalance; // bigint from viem

      // Update balances immediately to avoid UI delay
      setUserBalance(newContractBalance); // wei
      setWalletBalance(newWalletBalance); // wei

      // Fetch user stats in parallel without blocking balances
      (async () => {
        try {
          const leaderboardResponse = await fetch(`/api/leaderboard?userAddress=${appEmbeddedAddress}`);
          const leaderboardData = await leaderboardResponse.json();
          let userSlapCountValue = 0;
          let userRankValue = 0;
          if (leaderboardResponse.ok && leaderboardData.userData) {
            userSlapCountValue = leaderboardData.userData.slapCount;
            userRankValue = leaderboardData.userData.rank;
          } else {
            try {
              const slapCount = await publicClient.readContract({
                address: contractAddress,
                abi: contractAbi,
                functionName: 'getSlapCount',
                args: [appEmbeddedAddress],
              });
              userSlapCountValue = Number(slapCount);
            } catch (error) {
              console.error('Failed to fetch slap count:', error);
            }
          }
          setUserSlapCount(userSlapCountValue);
          setUserRank(userRankValue);
          console.log('📊 User stats updated:', {
            slapCount: userSlapCountValue,
            rank: userRankValue,
          });
        } catch (e) {
          console.error('Failed to fetch leaderboard/user stats:', e);
        }
      })();

      // Auto-deposit logic: check if auto-deposit is needed
      const embeddedBalanceInMON = embeddedBalanceMon || 0;
      const contractBalanceMon = Number(formatUnits(newContractBalance, 18));
      const shouldAutoDeposit = contractBalanceMon < 0.005 && embeddedBalanceInMON >= 0.21;

      if (shouldAutoDeposit) {
        // Check if wallet balance increased (new deposit) OR if this is first time checking existing balance
        const isNewDeposit = (previousWalletBalance > 0n) && (newWalletBalance > previousWalletBalance);
        const isExistingBalance = (previousWalletBalance === 0n) && (newWalletBalance > 0n);

        if (isNewDeposit || isExistingBalance) {
          console.log('⛽ Auto-deposit needed - Contract balance below 0.005 MON and embedded wallet has sufficient MON');
          console.log(`Embedded Wallet: ${embeddedBalanceInMON.toFixed(4)} MON, Contract: ${contractBalanceMon.toFixed(4)} MON`);
          setTimeout(() => handleAutoDeposit(0.2), 1000); // Small delay to ensure state is updated
        }
      }
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    }
  };

  // Auto-deposit function using embedded wallet approach
  const handleAutoDeposit = async (amount) => {
    if (!walletClient.current || !authenticated || !appEmbeddedAddress) return;
    if (isAutoDepositing.current) return;
    
    // For auto-deposit, we'll use the embedded wallet to deposit to contract
    // This ensures the embedded wallet has funds for gameplay
    console.log('🚀 Auto-deposit starting from embedded wallet...');
    
    isAutoDepositing.current = true;

    try {
      addTransactionNotification('info', '🔄 Auto-Deposit Starting...', '');

      const depositData = encodeFunctionData({
        abi: contractAbi,
        functionName: 'depositTokens',
        args: [],
      });

      // Get fresh nonce from network to avoid conflicts
      const publicClient = createPublicClient({
        chain: monadTestnet,
        transport: http('https://testnet-rpc.monad.xyz/'),
      });
      const networkPendingNonce = await publicClient.getTransactionCount({
        address: appEmbeddedAddress,
        blockTag: 'pending',
      });
      const nonceToUse = userNonce.current > networkPendingNonce ? userNonce.current : networkPendingNonce;
      userNonce.current = nonceToUse + 1;

      const gasPrice = await publicClient.getGasPrice();
      // Monad testnet often needs higher fees; floor at 250 gwei and bump above current gas price
      const minFee = 250n * 10n ** 9n; // 250 gwei
      let maxFeePerGas = gasPrice * 10n;
      if (maxFeePerGas < minFee) maxFeePerGas = minFee;
      let maxPriorityFeePerGas = maxFeePerGas / 5n; // 20% of max fee



      // Prepare transaction parameters
      // Estimate gas to avoid underpricing errors
      const estimatedGasBigInt = await publicClient.estimateGas({
        account: appEmbeddedAddress,
        to: contractAddress,
        data: depositData,
        value: parseEther(String(amount)),
      });
      const estimatedGas = '0x' + estimatedGasBigInt.toString(16);

      // Check on-chain balance vs required max cost (value + gas budget)
      const onchainBalance = await publicClient.getBalance({ address: appEmbeddedAddress });
      // Some RPCs require an explicit gas field for sendTransaction; ensure minimum gas if estimate is tiny
      let gasHex = estimatedGas;
      try {
        const minGas = 50000n;
        if (estimatedGasBigInt < minGas) gasHex = '0x' + minGas.toString(16);
      } catch {}
      const requiredMaxCost = parseEther(String(amount)) + (estimatedGasBigInt * maxFeePerGas);
      console.log('⛽ Gas price (effective) gwei:', Number(maxFeePerGas) / 1e9);
      console.log('⛽ Estimated gas:', estimatedGasBigInt.toString());
      console.log('💳 Wallet balance (wei):', onchainBalance.toString());
      console.log('💸 Required max (wei):', requiredMaxCost.toString());
      // If this ever exceeds balance, abort silently (UI shows insufficient funds)
      if (requiredMaxCost > onchainBalance) return;

      const txParams = {
        from: appEmbeddedAddress,
        to: contractAddress,
        data: depositData,
        value: '0x' + parseEther(String(amount)).toString(16),
        nonce: '0x' + nonceToUse.toString(16),
        gas: gasHex,
        maxFeePerGas: '0x' + maxFeePerGas.toString(16),
        maxPriorityFeePerGas: '0x' + maxPriorityFeePerGas.toString(16),
        chainId: '0x' + monadTestnet.id.toString(16),
      };

      // Sign transaction using Privy
      const signedTransaction = await walletClient.current.request({
        method: 'eth_signTransaction',
        params: [txParams],
      });

      // Send directly via RPC
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
        const msg = (result.error.message || '').toLowerCase();
        // Retry once if nonce too low: refresh pending nonce and resend
        if (msg.includes('nonce too low')) {
          const refreshedPending = await publicClient.getTransactionCount({ address: privyAddress, blockTag: 'pending' });
          const retryNonce = Math.max(Number(userNonce.current), Number(refreshedPending));
          userNonce.current = BigInt(retryNonce + 1);
          const retryTx = { ...txParams, nonce: '0x' + BigInt(retryNonce).toString(16) };
          const signedRetry = await walletClient.current.request({ method: 'eth_signTransaction', params: [retryTx] });
          const resp2 = await fetch('https://testnet-rpc.monad.xyz/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 1, jsonrpc: '2.0', method: 'eth_sendRawTransaction', params: [signedRetry] }) });
          const res2 = await resp2.json();
          if (res2.error) throw new Error(`RPC Error: ${res2.error.message}`);
          const txHash2 = res2.result;
          addTransactionNotification('success', `💰 Auto-Deposited ${amount} MON`, txHash2);
          setTimeout(() => { fetchUserSlapCount(); fetchLeaderboard(); }, 3000);
          return;
        }
        // If fees too low, retry once with higher bump
        if (msg.includes('maxfeepergas')) {
          const bumpFee = maxFeePerGas * 2n;
          const bumpPriority = maxPriorityFeePerGas * 2n;
          const bumpedTx = {
            ...txParams,
            maxFeePerGas: '0x' + bumpFee.toString(16),
            maxPriorityFeePerGas: '0x' + bumpPriority.toString(16),
          };
          const signedBumped = await walletClient.current.request({
            method: 'eth_signTransaction',
            params: [bumpedTx],
          });
          const resp2 = await fetch('https://testnet-rpc.monad.xyz/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: 1, jsonrpc: '2.0', method: 'eth_sendRawTransaction', params: [signedBumped] }),
          });
          const res2 = await resp2.json();
          if (res2.error) throw new Error(`RPC Error: ${res2.error.message}`);
          const txHash = res2.result;
          addTransactionNotification('success', `💰 Auto-Deposited ${amount} MON`, txHash);
          setTimeout(() => { fetchUserSlapCount(); fetchLeaderboard(); }, 3000);
          return;
        }
        throw new Error(`RPC Error: ${result.error.message}`);
      }

      const txHash = result.result;
      addTransactionNotification('success', `💰 Auto-Deposited ${amount} MON`, txHash);

      // Refresh balances after auto-deposit
      setTimeout(() => {
        fetchUserSlapCount();
        fetchLeaderboard();
      }, 3000);

    } catch (error) {
      console.error('Auto-deposit failed:', error);
      // Disable further auto-deposit attempts this session to avoid spamming
      setHasAttemptedAirdrop(true);
      // Silently handle auto-deposit failures - no error popup
    }
    finally {
      isAutoDepositing.current = false;
    }
  };

  // Verify we're using the correct wallet before transactions
  const verifyCorrectWallet = () => {
    if (!selectedWalletAddress.current || !appEmbeddedAddress) {
      console.log('❌ No selected wallet or embedded wallet address');
      return false;
    }
    
    if (selectedWalletAddress.current.toLowerCase() !== appEmbeddedAddress.toLowerCase()) {
      console.log('❌ Wallet mismatch!');
      console.log('❌ Selected wallet:', selectedWalletAddress.current);
      console.log('❌ Embedded wallet address:', appEmbeddedAddress);
      console.log('❌ This will cause "insufficient balance" errors');
      return false;
    }
    
    console.log('✅ Wallet verification passed');
    return true;
  };

  // Manual deposit from embedded wallet
  const handleManualDeposit = async (amount) => {
    console.log('🔍 handleManualDeposit called with amount:', amount);
    console.log('🔍 walletClient.current:', walletClient.current);
    console.log('🔍 authenticated:', authenticated);
    console.log('🔍 appEmbeddedAddress:', appEmbeddedAddress);
    console.log('🔍 selectedWalletAddress.current:', selectedWalletAddress.current);
    
    if (!authenticated || !appEmbeddedAddress) {
      console.log('❌ Early return - missing requirements');
      console.log('❌ walletClient.current:', !!walletClient.current);
      console.log('❌ authenticated:', authenticated);
      console.log('❌ appEmbeddedAddress:', !!appEmbeddedAddress);
      return;
    }
    
    // If provider isn't ready, but we have cross-app sendTransaction, use it
    
    try {
      console.log('✅ Starting manual deposit...');
      addTransactionNotification('info', '🔄 Preparing deposit...', '');

      const depositData = encodeFunctionData({
        abi: contractAbi,
        functionName: 'depositTokens',
        args: [],
      });
      
      console.log('📝 Deposit data encoded:', depositData);

      const publicClient = createPublicClient({
        chain: monadTestnet,
        transport: http('https://testnet-rpc.monad.xyz/'),
      });

      // Let the node handle nonce/fees; only estimate gas
      console.log('⛽ Estimating gas...');
      const estimatedGas = await publicClient.estimateGas({
        account: appEmbeddedAddress,
        to: contractAddress,
        data: depositData,
        value: parseEther(String(amount)),
      });
      
      console.log('⛽ Gas estimated:', Number(estimatedGas));

      const txParams = {
        from: appEmbeddedAddress,
        to: contractAddress,
        data: depositData,
        value: '0x' + parseEther(String(amount)).toString(16),
        gas: '0x' + estimatedGas.toString(16),
        chainId: monadTestnet.id,
      };
      
      console.log('📝 Transaction params:', txParams);
      console.log('🔐 Sending transaction...');

      let txHash;
      if (walletClient.current) {
        // Use injected provider if available
        txHash = await walletClient.current.request({ method: 'eth_sendTransaction', params: [txParams] });
      } else if (crossAppSendTransaction) {
        // Fallback to Privy cross-app flow
        txHash = await crossAppSendTransaction(txParams, { address: appEmbeddedAddress });
      } else {
        throw new Error('No provider available to send transaction');
      }
      
      console.log('✅ Transaction sent! Hash:', txHash);

      addTransactionNotification('success', `💰 Deposited ${amount} MON`, txHash);
      setTimeout(() => { fetchUserSlapCount(); fetchLeaderboard(); }, 3000);
    } catch (error) {
      console.error('❌ Manual deposit failed:', error);
      addTransactionNotification('error', '❌ Deposit failed. See console.', '');
    }
  };

  // Check user balance in contract
  const checkUserBalance = async () => {
    if (!appEmbeddedAddress) return 0;

    try {
      const publicClient = createPublicClient({
        chain: { id: 10143, name: 'Monad Testnet' },
        transport: http('https://testnet-rpc.monad.xyz/'),
      });

      const balance = await publicClient.readContract({
        address: contractAddress,
        abi: contractAbi,
        functionName: 'userBalances',
        args: [appEmbeddedAddress],
      });

      return Number(balance);
    } catch (err) {
      console.error('Failed to check user balance:', err);
      return 0;
    }
  };

  // Handle frame viewing
  // Use app embedded wallet for one-click (no modal) on in-game contract
  // Still attribute score/tx to MGID via server after completion
  const handleFrameViewPrivy = async (frameNumber) => {
    if (!authenticated || !appEmbeddedAddress) {
      setTxStatus('❌ Wallet not ready. Please wait...');
      return;
    }

    try {
      // Check contract balance only for frames 2 and 161 (more accessible than 1 and 162)
      if (frameNumber === 2 || frameNumber === 161) {
         // Use the cached balance from state instead of making RPC calls
         const currentBalance = userBalanceMon; // already in MON
         console.log(`💰 Using cached contract balance: ${currentBalance.toFixed(4)} MON`);
         
         if (currentBalance < 0.001) {
           console.log('❌ Insufficient contract balance for frame viewing');
          // Silently return if insufficient balance - no error popup
          return;
        }
      }

      // Map frontend frames to contract frames for compatibility
      // Frontend Frame 2 → Contract Frame 1 (slap start)
      // Frontend Frame 161 → Contract Frame 162 (slap complete)
      let contractFrameNumber = frameNumber;
      if (frameNumber === 2) {
        contractFrameNumber = 1;
        console.log('🔄 Mapping frontend Frame 2 → Contract Frame 1 (slap start)');
      } else if (frameNumber === 161) {
        contractFrameNumber = 162;
        console.log('🔄 Mapping frontend Frame 161 → Contract Frame 162 (slap complete)');
      }

      const viewFrameData = encodeFunctionData({
        abi: contractAbi,
        functionName: 'viewFrame',
        args: [contractFrameNumber],
      });

      let txHash;

      // Prefer app embedded wallet direct RPC for one-click
      const publicClient = createPublicClient({
        chain: monadTestnet,
        transport: http('https://testnet-rpc.monad.xyz/'),
      });

      // Dynamic gas limit based on frame complexity
      let gasLimit;
      if (frameNumber === 161) {
        gasLimit = '0x7A120'; // 500,000 gas for Frame 161 (leaderboard updates, slap completion)
        console.log('🎯 Using high gas limit for Frame 161 completion');
      } else if (frameNumber === 2) {
        gasLimit = '0x30D40'; // 200,000 gas for Frame 2 (slap start)
        console.log('🥊 Using medium gas limit for Frame 2 start');
      } else {
        gasLimit = '0x186A0'; // 100,000 gas for other frames (shouldn't be used)
        console.log('⚡ Using standard gas limit for Frame', frameNumber);
      }

      const embeddedWalletObj = appEmbeddedAddress
        ? wallets.find(w => w.address?.toLowerCase() === appEmbeddedAddress.toLowerCase())
        : null;
      const provider = embeddedWalletObj && typeof embeddedWalletObj.getEthereumProvider === 'function'
        ? await embeddedWalletObj.getEthereumProvider()
        : null;

      if (embeddedWalletObj && provider) {
        // Secondary: direct sign + raw RPC send via embedded wallet provider (no modal)
        console.log('🛠 Using direct sign + raw RPC send via embedded wallet');
        const walletClient = createWalletClient({
          chain: monadTestnet,
          transport: custom(provider),
        });
        // Estimate and bump gas to avoid low maxFee errors
        const baseGasPrice = await publicClient.getGasPrice();
        const effectiveGasPrice = baseGasPrice * 10n; // 10x bump to avoid mempool rejection on Monad
        const nonce = await publicClient.getTransactionCount({ address: embeddedWalletObj.address });
        const signed = await walletClient.signTransaction({
          account: embeddedWalletObj.address,
        to: contractAddress,
        data: viewFrameData,
          gas: parseInt(gasLimit, 16),
          maxFeePerGas: effectiveGasPrice,
          maxPriorityFeePerGas: effectiveGasPrice / 10n,
          nonce,
          value: 0n,
          chain: monadTestnet,
        });
        const response = await fetch(monadTestnet.rpcUrls.default.http[0], {
        method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 1,
          jsonrpc: '2.0',
          method: 'eth_sendRawTransaction',
            params: [signed],
        }),
      });
        let result = await response.json();
        if (result.error && /maxFeePerGas/i.test(result.error.message || '')) {
          // Single retry with 2x fees
          const retrySigned = await walletClient.signTransaction({
            account: embeddedWalletObj.address,
            to: contractAddress,
            data: viewFrameData,
            gas: parseInt(gasLimit, 16),
            maxFeePerGas: effectiveGasPrice * 2n,
            maxPriorityFeePerGas: (effectiveGasPrice * 2n) / 10n,
            nonce,
            value: 0n,
            chain: monadTestnet,
          });
          const retryResp = await fetch(monadTestnet.rpcUrls.default.http[0], {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: 2, jsonrpc: '2.0', method: 'eth_sendRawTransaction', params: [retrySigned] }),
          });
          result = await retryResp.json();
        }
        if (result.error) throw new Error(`RPC Error: ${result.error.message}`);
      txHash = result.result;
        console.log('✅ Direct RPC transaction sent:', txHash);
      } else if (appEmbeddedAddress && typeof privySendTransaction === 'function') {
        // Fallback: one-click using app's embedded wallet API
        console.log('🚀 Using app embedded wallet sendTransaction (no modal)');
        const gasPrice = await publicClient.getGasPrice();
        const request = {
          chainId: monadTestnet.id,
          to: contractAddress,
          value: 0,
          data: viewFrameData,
          gasLimit: parseInt(gasLimit, 16),
          gasPrice: Number(gasPrice),
        };
        txHash = await privySendTransaction(request);
        console.log('✅ Embedded wallet transaction sent:', txHash);
      } else {
        // Do NOT fall back to cross-app wallet for frames to avoid modal popups
        console.warn('⚠️ Embedded wallet not ready for frame TX; skipping to avoid popup');
        throw new Error('Embedded wallet not ready. Please wait a moment and try again.');
      }

      // Add transaction notification
      if (frameNumber === 2) {
        addTransactionNotification('success', '🥊 Punch Started!', txHash);
        setSlapInProgress(true);

        // Show comic bubble for punch start
        const startTexts = ['POW!!', 'WHAM!', 'KAPOW!', 'SMACK!'];
        const positions = ['left', 'right', 'inside'];
        const randomText = startTexts[Math.floor(Math.random() * startTexts.length)];
        const randomPosition = positions[Math.floor(Math.random() * positions.length)];
        setComicBubble({ text: randomText, type: 'start', position: randomPosition });
        setTimeout(() => setComicBubble(null), 2000);

      } else if (frameNumber === 161) {
        addTransactionNotification('success', '💥 Punch Completed!', txHash);
        setSlapInProgress(false);
        setSessionPunchCount(prev => prev + 1); // Increment session counter

        // Submit score (1) and tx count (1) increment to server for onchain submission
        try {
          fetch('/api/monad-games/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              player: privyAddress, // attribute to MGID identity wallet for global leaderboard
              scoreDelta: 1,
              txDelta: 1,
            }),
          }).catch(() => {});
        } catch {}

        // Show comic bubble for punch complete
        const completeTexts = ['BAM!!', 'BOOM!', 'WHOOSH!', 'CRASH!', 'ZAP!!'];
        const positions = ['left', 'right', 'inside'];
        const randomText = completeTexts[Math.floor(Math.random() * completeTexts.length)];
        const randomPosition = positions[Math.floor(Math.random() * positions.length)];
        setComicBubble({ text: randomText, type: 'complete', position: randomPosition });
        setTimeout(() => setComicBubble(null), 2000);

      } else {
        addTransactionNotification('success', `✅ Frame ${frameNumber} Viewed`, txHash);
      }

                           // Update leaderboard and user data after transaction
        setTimeout(async () => {
          // Refresh from backend after transaction
          fetchLeaderboard(true); // Force refresh
        fetchUserSlapCount();
        }, 3000); // Reduced delay since backend handles rate limiting

    } catch (err) {
      console.error('Frame view transaction error:', err);

      // Don't show error notifications to users - keep UI clean
      // Just handle nonce issues silently

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
      }
      // Silently handle errors - no user-facing error messages
    }
  };

  // Throttled frame update for better performance
  const frameUpdateRef = useRef(null);
  const pendingFrameRef = useRef(null);
  const lastChargedFrameRef = useRef(null);

  // Eelslap-style interaction - position directly controls frame
  const updateFrameFromPosition = useCallback((clientX) => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const nextFrame = Math.floor(percentage * 162) + 1;

    if (nextFrame < 1 || nextFrame > 162) return;
    if (nextFrame === pendingFrameRef.current) return;
    pendingFrameRef.current = nextFrame;

    if (!frameUpdateRef.current) {
      frameUpdateRef.current = requestAnimationFrame(() => {
        const target = pendingFrameRef.current;
        frameUpdateRef.current = null;
        if (typeof target !== 'number') return;
        if (target !== currentFrame) {
          setCurrentFrame(target);

          if (target === 2 || target === 161) {
            if (lastChargedFrameRef.current !== target) {
              lastChargedFrameRef.current = target;
              handleFrameViewPrivy(target);
            }
          } else if (target > 2 && target < 161) {
          setSlapInProgress(true);
        }
      }
      });
    }
  }, [currentFrame, handleFrameViewPrivy]);

  // Handle mouse movement (desktop)
  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current) return;
    updateFrameFromPosition(e.clientX);
  }, [updateFrameFromPosition]);

  // Handle touch movement (mobile)
  const handleTouchMove = useCallback((e) => {
    if (!containerRef.current) return;
    e.preventDefault(); // Prevent scrolling
    const touch = e.touches[0];
    if (touch) {
      updateFrameFromPosition(touch.clientX);
    }
  }, [updateFrameFromPosition]);

  // Handle touch start (mobile)
  const handleTouchStart = useCallback((e) => {
    if (!containerRef.current) return;
    e.preventDefault(); // Prevent scrolling
    const touch = e.touches[0];
    if (touch) {
      updateFrameFromPosition(touch.clientX);
    }
  }, [updateFrameFromPosition]);

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

      // Get fresh nonce from network to avoid conflicts
      const publicClient = createPublicClient({
        chain: monadTestnet,
        transport: http('https://testnet-rpc.monad.xyz/'),
      });
      const currentNonce = await publicClient.getTransactionCount({
        address: privyAddress,
      });
      userNonce.current = currentNonce + 1;

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
        nonce: '0x' + currentNonce.toString(16),
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
    if (appEmbeddedAddress) {
      try {
        await navigator.clipboard.writeText(appEmbeddedAddress);
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
    // Normalize hash into a string when possible
    const normalizedHash = typeof hash === 'string'
      ? hash
      : (hash && typeof hash === 'object' && typeof hash.hash === 'string')
        ? hash.hash
        : null;

    const notification = {
      id: Date.now(),
      type, // 'success' or 'error'
      title,
      hash: normalizedHash,
      timestamp: Date.now()
    };

    // On mobile, show only one notification at a time (replace previous)
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      setTransactionNotifications([notification]); // Only one notification on mobile
    } else {
      setTransactionNotifications(prev => [notification, ...prev.slice(0, 2)]); // Keep max 3 notifications on desktop
    }

    // Auto-remove after shorter time on mobile
    setTimeout(() => {
      setTransactionNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, isMobile ? 5000 : 10000); // 5 seconds on mobile, 10 seconds on desktop
  };

  // Replace the existing tryFirstTimeAirdrop function with this:

const tryFirstTimeAirdrop = useCallback(async () => {
  try {
    console.log('�� Attempting gasless airdrop via relayer...');
    
    if (!authenticated || !wallets.length || !privyAddress) {
      console.log('❌ Airdrop skipped - not authenticated or no wallet');
      return;
    }

    // Prevent repeat attempts this session
    setHasAttemptedAirdrop(true);

    // Check if user already claimed (local check)
    const storageKey = `johnwrizzkid-airdrop-claimed-${privyAddress.toLowerCase()}`;
    const alreadyClaimedLocal = localStorage.getItem(storageKey) === '1';
    
    if (alreadyClaimedLocal) {
      console.log('❌ Airdrop skipped - already claimed locally');
      return;
    }

    // Call the relayer API instead of blockchain directly
    addTransactionNotification('info', 'Claiming welcome Drop (0.8 MON)...', '');
    
    const response = await fetch('/api/relayer/airdrop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress: privyAddress })
    });

    const result = await response.json();

         if (response.ok && result.success) {
       console.log('🎉 Airdrop claimed successfully! TX Hash:', result.hash);
       addTransactionNotification('success', '🎉 Drop claimed! +0.8 MON', result.hash);
       localStorage.setItem(storageKey, '1');

               // Refresh balances after airdrop settles
        setTimeout(async () => {
          fetchUserSlapCount();
          fetchLeaderboard(true);
        }, 3000);
     } else {
       // Don't throw error - just log it since airdrop might have succeeded
       console.log('⚠️ Airdrop response not perfect but might have succeeded:', result);
       addTransactionNotification('success', '🎉 Drop claimed! +0.8 MON', result.hash || '');
       localStorage.setItem(storageKey, '1');

                                 // Still refresh balances
          setTimeout(async () => {
            fetchUserSlapCount();
            fetchLeaderboard(true);
          }, 3000);
     }

  } catch (error) {
    console.error('❌ Airdrop failed:', error);
    //addTransactionNotification('error', '❌ Airdrop failed: ' + error.message, null);
  }
}, [authenticated, wallets, privyAddress]);
  // Close instructions and mark as seen
  const closeInstructions = () => {
    setShowInstructions(false);
    localStorage.setItem('johnwrizzkid-instructions-seen', 'true');
  };

  // Render the frame image
  const frameSrc = `/johngettingpunched/frame_${String(currentFrame).padStart(5, '0')}.png`;

  // Avoid spamming console logs per frame change in production

  // Set page title
  useEffect(() => {
    document.title = 'JohnWRizzKid';
  }, []);

  // Preload a few key frames once
  useEffect(() => {
      const keyFrames = [1, 81, 162];
    keyFrames.forEach((frame) => {
        const img = new Image();
      img.src = `/johngettingpunched/frame_${String(frame).padStart(5, '0')}.png`;
    });
  }, []);

  // Lightweight sliding-window preloader around current frame
  useEffect(() => {
    const neighbors = [
      currentFrame - 3,
      currentFrame - 2,
      currentFrame - 1,
      currentFrame,
      currentFrame + 1,
      currentFrame + 2,
      currentFrame + 3,
    ].filter((f) => f >= 1 && f <= 162);

    neighbors.forEach((frame) => {
              const img = new Image();
      img.src = `/johngettingpunched/frame_${String(frame).padStart(5, '0')}.png`;
    });
  }, [currentFrame]);

  // Check if game is registered on Monad Games ID contract (noop if already registered)
  const checkGameRegistration = async () => {
    setIsGameRegistered(true);
  };

  // Register game on Monad Games ID contract (disabled since already registered)
  const registerGameOnMonad = async () => {
    addTransactionNotification('success', '🎮 Game already registered', '');
    setIsGameRegistered(true);
  };

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
              Only frames 2 & 161 cost 0.001 MON each. All other frames are completely FREE!
            </p>
            <button onClick={login} className={styles.connectButton}>
              {username ? `Signed in as @${username}` : 'Sign in with Monad Games ID'}
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
                <strong>Wallet:</strong> {embeddedBalanceMon != null ? `${embeddedBalanceMon} MON` : '...'}
              </div>
              <div className={styles.balance}>
                <strong>Contract:</strong> {userBalanceMon.toFixed(4)} MON
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
              {/* Left Side - Wallet & Deposit */}
              <div className={styles.controlsPanel} style={{ transform: 'rotate(1deg)' }}>
                <h3>💰 Wallet & Deposit</h3>

                {/* Contract and Wallet Balance
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: '#2c2c2c' }}>
                    Contract Balance: <span style={{ color: '#4ecdc4', fontWeight: '700' }}>{userBalanceMon.toFixed(4)} MON</span>
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: '#2c2c2c' }}>
                    Your Wallet: <span style={{ color: '#4ecdc4', fontWeight: '700' }}>{embeddedBalanceMon != null ? `${embeddedBalanceMon} MON` : '...'}</span>
                  </div>
                </div> */}

                {/* Wallet Address */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.3rem' }}>
                    Your Wallet Address:
                  </div>
                  <div style={{
                    background: '#f8f8f8',
                    border: '2px solid #2c2c2c',
                    borderRadius: '8px',
                    padding: '0.5rem',
                    fontSize: '0.7rem',
                    fontFamily: 'Monaco, monospace',
                    wordBreak: 'break-all',
                    marginBottom: '0.5rem'
                  }}>
                    {appEmbeddedAddress || 'Loading...'}
                  </div>
                  <button
                    onClick={copyWalletAddress}
                    style={{
                      background: '#4ecdc4',
                      color: '#2c2c2c',
                      border: '2px solid #2c2c2c',
                      borderRadius: '8px',
                      padding: '0.3rem 0.8rem',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      boxShadow: '2px 2px 0px rgba(44, 44, 44, 0.3)',
                      width: '100%'
                    }}
                  >
                    {copyButtonText}
                  </button>
                </div>



                {/* Auto-Deposit Button (if needed) */}
                {embeddedBalanceMon >= 0.2 && userBalanceMon < 0.005 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <button
                      onClick={() => handleAutoDeposit(0.2)}
                      disabled={!walletClient.current}
                      style={{
                        background: '#ff6b6b',
                        color: 'white',
                        border: '2px solid #2c2c2c',
                        borderRadius: '15px',
                        padding: '0.8rem',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        fontWeight: '600',
                        boxShadow: '3px 3px 0px rgba(44, 44, 44, 0.3)',
                        width: '100%'
                      }}
                    >
                      🚀 Auto-Deposit 0.2 MON
                    </button>
                  </div>
                )}

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
                <div
                  className={styles.sessionPunches}
                  style={{
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
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={() => {}} // Keep frame where user lifted finger (eelslap style)
                  style={{
                    position: 'relative',
                    touchAction: 'none' // Prevent default touch behaviors
                  }}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0 }}>🏆 Leaderboard</h3>
                                       <button
                      onClick={async () => {
                        // Force refresh from backend
                        fetchLeaderboard(true);
                      fetchUserSlapCount();
                    }}
                    style={{
                      background: '#4ecdc4',
                      color: 'white',
                      border: '2px solid #2c2c2c',
                      borderRadius: '8px',
                      padding: '0.3rem 0.6rem',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      fontWeight: '600',
                      boxShadow: '2px 2px 0px rgba(44, 44, 44, 0.3)'
                    }}
                  >
                    🔄 Refresh
                   </button>
                </div>

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
                  maxHeight: '280px',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  paddingRight: '8px',
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#4ecdc4 #f0f0f0'
                }}>
                  <style jsx>{`
                    div::-webkit-scrollbar {
                      width: 8px;
                    }
                    div::-webkit-scrollbar-track {
                      background: #f0f0f0;
                      border-radius: 4px;
                    }
                    div::-webkit-scrollbar-thumb {
                      background: #4ecdc4;
                      border-radius: 4px;
                      border: 1px solid #2c2c2c;
                    }
                    div::-webkit-scrollbar-thumb:hover {
                      background: #45b7aa;
                    }
                  `}</style>
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
                          marginRight: '4px',
                          background: entry.address.toLowerCase() === appEmbeddedAddress.toLowerCase() ? '#e8f5e8' : '#f8f9fa',
                          border: entry.address.toLowerCase() === appEmbeddedAddress.toLowerCase() ? '2px solid #4ecdc4' : '2px solid #2c2c2c',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          transition: 'transform 0.1s ease',
                          cursor: 'default'
                        }}
                        onMouseEnter={(e) => e.target.style.transform = 'scale(1.02)'}
                        onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
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
                          {entry.address.toLowerCase() === appEmbeddedAddress.toLowerCase() && (
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

                {/* Global Leaderboard (Monad Games ID) */}
                <div style={{
                  marginTop: '0.75rem',
                  border: '2px dashed #2c2c2c',
                  borderRadius: '12px',
                  padding: '0.75rem',
                  background: '#fafafa',
                  boxShadow: '6px 6px 0 #2c2c2c'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h4 style={{ margin: 0 }}>🌐 Global Leaderboard</h4>
                    <a href="https://monad-games-id-site.vercel.app/" target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem' }}>Reserve Username</a>
                  </div>
                  {globalLeaderboard.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#666' }}>No global data yet.</div>
                  ) : (
                    globalLeaderboard.slice(0, 10).map((entry, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.5rem 0.75rem',
                        marginBottom: '0.5rem',
                        background: '#fff',
                        border: '2px solid #2c2c2c',
                        borderRadius: '8px'
                      }}>
                        <div style={{ fontWeight: '600', color: '#2c2c2c' }}>
                          #{entry.rank || idx + 1}
                        </div>
                        <div style={{ fontFamily: 'Monaco, monospace', fontSize: '0.8rem', color: '#555' }}>
                          {entry.username || entry.address || 'Player'}
                        </div>
                        <div style={{ fontWeight: '600', color: '#4ecdc4' }}>
                          {entry.score || entry.slapCount || 0}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Doodle-Style Instructions Section Below Game */}
          <div
            className={styles.instructionsSection}
            style={{
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
                      <span style={{ color: '#ff6b6b', fontWeight: 'bold' }}>→</span> Copy your wallet address and get MON tokens
                    </p>
                    <p style={{ color: '#333', marginBottom: '0.7rem' }}>
                      <span style={{ color: '#ff6b6b', fontWeight: 'bold' }}>→</span> Send MON to your wallet address (minimum 0.2 MON)
                    </p>
                    <p style={{ color: '#333' }}>
                      <span style={{ color: '#ff6b6b', fontWeight: 'bold' }}>→</span> 0.2 MON automatically deposits to contract for punching!
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
                     Step 3: Smart Deductions
                  </h3>
                  <div style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
                    <p style={{ color: '#333', marginBottom: '0.7rem' }}>
                      <span style={{ color: '#ff6b6b', fontWeight: 'bold' }}>→</span> Only Frames 1 & 162 cost MON (0.001 each)
                    </p>
                    <p style={{ color: '#333', marginBottom: '0.7rem' }}>
                      <span style={{ color: '#ff6b6b', fontWeight: 'bold' }}>→</span> Frames 2-161 are completely FREE!
                    </p>
                    <p style={{ color: '#333' }}>
                      <span style={{ color: '#ff6b6b', fontWeight: 'bold' }}>→</span> MON automatically deducted from your contract balance!
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

          {/* Contract Balance Warning - Right Corner (Small) */}
          {authenticated && userBalanceMon < 0.1 && window.innerWidth > 768 && (
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
              maxWidth: '320px',
              fontFamily: 'Comic Sans MS, cursive, sans-serif'
            }}>
              <div style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                ⚠️ Contract Balance Low!
              </div>
              <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                Deposit more MON to the contract to keep punching!
              </div>
    <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
      Current: {userBalanceMon.toFixed(4)} MON
              </div>
  </div>
)}

{/* Contract Balance Warning - Mobile (Current Compact Style) */}
{authenticated && userBalanceMon < 0.1 && window.innerWidth > 768 && (
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
    maxWidth: '320px',
    fontFamily: 'Comic Sans MS, cursive, sans-serif'
  }}>
    <div style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.5rem' }}>
      ⚠️ Contract Balance Low!
    </div>
    <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
      Deposit more MON to the contract to keep punching!
    </div>
    <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
      Current: {userBalanceMon.toFixed(4)} MON
    </div>
  </div>
)}

{/* Contract Balance Warning - Mobile (Current Compact Style) */}
{authenticated && userBalanceMon < 0.1 && window.innerWidth <= 768 && (
  <div style={{
    position: 'fixed',
    bottom: '15px',
    right: '15px',
    background: '#ff6b6b',
    color: 'white',
    padding: '0.6rem 0.8rem',
    borderRadius: '8px',
    border: '2px solid #2c2c2c',
    boxShadow: '2px 2px 0px rgba(44, 44, 44, 0.3)',
    zIndex: 1000,
    maxWidth: '200px',
    fontSize: '0.75rem',
    fontFamily: 'Comic Sans MS, cursive, sans-serif',
    transform: 'rotate(1deg)'
  }}>
    <div style={{ fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.2rem' }}>
      ⚠️ Contract Low
    </div>
    <div style={{ fontSize: '0.65rem', opacity: 0.9 }}>
      {userBalanceMon.toFixed(3)} MON
    </div>
  </div>
)}

{/* Wallet Low Balance Warning - Desktop (Original Large Style) */}
{authenticated && walletBalanceMon < 0.04 && window.innerWidth > 768 && (
  <div style={{
    position: 'fixed',
    bottom: '20px',
    left: '20px',
    background: '#ffc107',
    color: '#2c2c2c',
    padding: '1rem 1.5rem',
    borderRadius: '15px',
    border: '3px solid #2c2c2c',
    boxShadow: '4px 4px 0px rgba(44, 44, 44, 0.3)',
    zIndex: 1000,
    maxWidth: '320px',
    fontFamily: 'Comic Sans MS, cursive, sans-serif'
  }}>
    <div style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.5rem' }}>
      ⚠️ Wallet Balance Low!
    </div>
    <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
      Top up your wallet to continue playing smoothly.
    </div>
    <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
      Current: {walletBalanceMon.toFixed(4)} MON
    </div>
  </div>
)}

{/* Wallet Low Balance Warning - Mobile (Current Compact Style) */}
{authenticated && walletBalanceMon < 0.04 && window.innerWidth <= 768 && (
  <div style={{
    position: 'fixed',
    bottom: '15px',
    left: '15px',
    background: '#ffc107',
    color: '#2c2c2c',
    padding: '0.6rem 0.8rem',
    borderRadius: '8px',
    border: '2px solid #2c2c2c',
    boxShadow: '2px 2px 0px rgba(44, 44, 44, 0.3)',
    zIndex: 1000,
    maxWidth: '200px',
    fontSize: '0.75rem',
    fontFamily: 'Comic Sans MS, cursive, sans-serif',
    transform: 'rotate(-1deg)'
  }}>
    <div style={{ fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.2rem' }}>
      ⚠️ Low Balance
    </div>
    <div style={{ fontSize: '0.65rem', opacity: 0.9 }}>
      {walletBalanceMon.toFixed(3)} MON
    </div>
  </div>
)}

{/* Wallet Low Balance Warning - Mobile (Current Compact Style) */}
{authenticated && walletBalanceMon < 0.04 && window.innerWidth <= 768 && (
  <div style={{
    position: 'fixed',
    bottom: '15px',
    left: '15px',
    background: '#ffc107',
    color: '#2c2c2c',
    padding: '0.6rem 0.8rem',
    borderRadius: '8px',
    border: '2px solid #2c2c2c',
    boxShadow: '2px 2px 0px rgba(44, 44, 44, 0.3)',
    zIndex: 1000,
    maxWidth: '200px',
    fontSize: '0.75rem',
    fontFamily: 'Comic Sans MS, cursive, sans-serif',
    transform: 'rotate(-1deg)'
  }}>
    <div style={{ fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.2rem' }}>
      ⚠️ Low Balance
    </div>
    <div style={{ fontSize: '0.65rem', opacity: 0.9 }}>
      {walletBalanceMon.toFixed(3)} MON
              </div>
            </div>
          )}

          {/* Instructions Popup for First-Time Users */}
          {showInstructions && (
            <>
              <style jsx>{`
                .instructions-popup::-webkit-scrollbar {
                  width: 10px;
                }
                .instructions-popup::-webkit-scrollbar-track {
                  background: rgba(44, 44, 44, 0.1);
                  border-radius: 15px;
                  border: 1px solid rgba(44, 44, 44, 0.2);
                }
                .instructions-popup::-webkit-scrollbar-thumb {
                  background: linear-gradient(45deg, #4ecdc4, #ff6b6b);
                  border-radius: 15px;
                  border: 2px solid #2c2c2c;
                  box-shadow: 2px 2px 4px rgba(44, 44, 44, 0.3);
                }
                .instructions-popup::-webkit-scrollbar-thumb:hover {
                  background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
                  box-shadow: 2px 2px 6px rgba(44, 44, 44, 0.4);
                }
              `}</style>
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
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#4ecdc4 rgba(44, 44, 44, 0.2)'
                }}
                className="instructions-popup"
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
                      • 0.2 MON automatically deposits to contract when you add funds!
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
                      • Left side = Frame 2, Right side = Frame 161
                    </p>
                    <p style={{ color: '#333' }}>
                      • Complete a punch: Frame 2 → Frame 161 (costs 0.002 MON total)
                    </p>
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ color: '#4ecdc4', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                      ⚡ Step 3: Automatic Deductions
                    </h3>
                    <p style={{ color: '#333', marginBottom: '0.5rem' }}>
                      • Only Frames 2 & 161 cost MON (0.001 each)
                    </p>
                    <p style={{ color: '#333', marginBottom: '0.5rem' }}>
                      • All other frames are completely FREE!
                    </p>
                    <p style={{ color: '#333' }}>
                      • MON automatically deducted from your contract balance!
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
                      1. <strong>Start at Frame 2</strong> - This begins your punch
                    </p>
                    <p style={{ color: '#856404', marginBottom: '0.3rem' }}>
                      2. <strong>Move through frames</strong> - Navigate to Frame 161
                    </p>
                    <p style={{ color: '#856404' }}>
                      3. <strong>Complete at Frame 161</strong> - This records your punch!
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
            </>
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