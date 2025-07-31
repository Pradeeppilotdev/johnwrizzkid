import { useState, useRef, useEffect } from 'react';
import styles from '../styles/Home.module.css';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useAccount, useBalance } from 'wagmi';
import { setupSmartAccount } from '../utils/pimlico';
import { encodeFunctionData } from 'viem';
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
    stateMutability: 'nonpayable',
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
];
const contractAddress = '0xDf7A0777b164a9bA6278B2D3979Ea8eCfE915855'; // TODO: Replace with your deployed contract

export default function Home() {
  const [currentFrame, setCurrentFrame] = useState(1);
  const [smartAccountClient, setSmartAccountClient] = useState(null);
  const [txStatus, setTxStatus] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [hasDeposited, setHasDeposited] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [userSlapCount, setUserSlapCount] = useState(0);
  const [userRank, setUserRank] = useState(0);
  const [slapInProgress, setSlapInProgress] = useState(false);
  const containerRef = useRef(null);
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const privyAddress = wallets.length > 0 ? wallets[0].address : '';

  // Move useBalance inside the component and only call if privyAddress exists
  const {
    data: monBalance,
    isLoading: isBalanceLoading
  } = useBalance(
    privyAddress
      ? {
          address: privyAddress,
          chainId: monadTestnet.id,
          watch: true,
          enabled: true,
        }
      : {
          address: undefined,
          enabled: false,
        }
  );

  // Switch wallet to Monad Testnet after connection
  useEffect(() => {
    if (wallets.length > 0) {
      wallets[0].switchChain(10143); // Monad Testnet chain ID
    }
  }, [wallets]);

  // Check if using embedded wallet (this is what we want for no signatures)
  const isUsingEmbeddedWallet = wallets.length > 0 && wallets[0].walletClientType === 'privy';
  
  // Setup Privy smart wallet (no Pimlico needed)
  useEffect(() => {
    if (!wallets.length) return;
    async function setup() {
      setTxStatus('Setting up Privy smart wallet...');
      try {
        console.log('Setting up with Privy wallet:', wallets[0].address);
        console.log('Wallet type:', wallets[0].walletClientType);
        console.log('Is embedded wallet:', isUsingEmbeddedWallet);
        
        if (!isUsingEmbeddedWallet) {
          setTxStatus('⚠️ Please use embedded wallet for seamless experience!');
          return;
        }
        
        // Use Privy wallet directly - no smart account needed
        setSmartAccountClient(null); // We don't need Pimlico smart account
        setTxStatus('✅ Privy embedded wallet ready! (No signatures needed)');
      } catch (err) {
        console.error('Privy wallet setup error:', err);
        setTxStatus('Privy wallet setup failed: ' + err.message);
      }
    }
    setup();
  }, [wallets, isUsingEmbeddedWallet]);

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
      const wallet = wallets[0];
      const provider = await wallet.getEthereumProvider();
      
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
      const wallet = wallets[0];
      const provider = await wallet.getEthereumProvider();
      
      // Create a simple public client for reading
      const { createPublicClient, http } = await import('viem');
      const publicClient = createPublicClient({
        chain: { id: 10143, name: 'Monad Testnet' },
        transport: http('https://testnet-rpc.monad.xyz/'),
      });
      
      const [slapCount, userRank] = await Promise.all([
        publicClient.readContract({
          address: contractAddress,
          abi: contractAbi,
          functionName: 'getSlapCount',
          args: [privyAddress],
        }),
        publicClient.readContract({
          address: contractAddress,
          abi: contractAbi,
          functionName: 'getUserRank',
          args: [privyAddress],
        }),
      ]);
      
      setUserSlapCount(Number(slapCount));
      setUserRank(Number(userRank));
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    }
  };

  // Handle frame viewing with direct Privy wallet (no smart account)
  const handleFrameViewDirect = async (frameNumber) => {
    if (!wallets.length || !privyAddress) return;
    
    try {
      const wallet = wallets[0];
      const provider = await wallet.getEthereumProvider();
      
      const viewFrameData = encodeFunctionData({
        abi: contractAbi,
        functionName: 'viewFrame',
        args: [frameNumber],
      });
      
      // Use direct wallet transaction instead of smart account
      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          to: contractAddress,
          data: viewFrameData,
          value: '0x0',
          gas: '0x186A0', // 100,000 gas limit
          maxFeePerGas: '0x59682F00', // 50 gwei in hex (much higher)
          maxPriorityFeePerGas: '0x59682F00', // 50 gwei in hex (much higher)
        }],
      });
      
      console.log('Direct frame view transaction:', txHash);
      
      // Update slap progress state
      if (frameNumber === 1) {
        setSlapInProgress(true);
        setTxStatus('🎯 Slap started! Now move to frame 162 to complete it');
      } else if (frameNumber === 162) {
        setSlapInProgress(false);
        setTxStatus('💥 Slap completed! +1 to your count');
      }
      
      // Update leaderboard after transaction
      if (frameNumber === 1 || frameNumber === 162) {
        setTimeout(() => {
          fetchLeaderboard();
          fetchUserSlapCount();
        }, 2000);
      }
    } catch (err) {
      console.error('Direct frame view error:', err);
      
      // Decode the error message
      let errorMessage = err.message;
      if (err.message.includes('0x08c379a0')) {
        if (err.message.includes('4e6f20736c617020696e2070726f6772657373')) {
          errorMessage = '❌ No slap in progress! Start with frame 1 first, then go to frame 162';
        } else if (err.message.includes('496e73756666696369656e742062616c616e6365')) {
          errorMessage = '❌ Insufficient balance! Deposit more MON tokens';
        } else if (err.message.includes('536c617020616c726561647920696e2070726f6772657373')) {
          errorMessage = '❌ Slap already in progress! Complete current slap first (go to frame 162)';
          setSlapInProgress(true);
        }
      }
      
      setTxStatus('Frame view failed: ' + errorMessage);
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
      
      // Trigger slap transaction for frames 1 and 162
      if (frameNumber === 1 || frameNumber === 162) {
        handleFrameViewDirect(frameNumber);
      }
    }
  };

  // Deposit MON to the contract using direct wallet
  const handleDeposit = async () => {
    if (!wallets.length || !depositAmount) return;
    setTxStatus('Depositing MON...');
    try {
      const wallet = wallets[0];
      const provider = await wallet.getEthereumProvider();
      
      const depositData = encodeFunctionData({
        abi: contractAbi,
        functionName: 'depositTokens',
        args: [],
      });
      
      console.log('Depositing amount:', depositAmount);
      console.log('Contract address:', contractAddress);
      console.log('Deposit calldata:', depositData);
      console.log('Value in wei:', BigInt(Number(depositAmount) * 1e18));
      
      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          to: contractAddress,
          data: depositData,
          value: '0x' + BigInt(Number(depositAmount) * 1e18).toString(16), // Convert to hex
          gas: '0x186A0', // 100,000 gas limit
          maxFeePerGas: '0x59682F00', // 50 gwei in hex (much higher)
          maxPriorityFeePerGas: '0x59682F00', // 50 gwei in hex (much higher)
        }],
      });
      
      console.log('Direct deposit transaction:', txHash);
      setTxStatus('Deposit successful! Hash: ' + txHash);
      setHasDeposited(true);
    } catch (err) {
      console.error('Direct deposit error:', err);
      setTxStatus('Deposit failed: ' + err.message);
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
        Privy App ID: {process.env.NEXT_PUBLIC_PRIVY_APP_ID || '❌ Not Set'}<br />
        Pimlico API Key: {process.env.NEXT_PUBLIC_PIMLICO_API_KEY ? '✅ Set' : '❌ Not Set'}<br />
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
              placeholder="Amount to deposit (MON)"
              value={depositAmount}
              onChange={e => setDepositAmount(e.target.value)}
              style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc', width: 200 }}
              disabled={!wallets.length}
            />
            <button onClick={handleDeposit} disabled={!wallets.length || !depositAmount} className={styles.animationButton}>
              Deposit MON
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
            <strong>Your Slaps:</strong> {userSlapCount} | <strong>Your Rank:</strong> {userRank > 0 ? `#${userRank}` : 'Not ranked'}
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