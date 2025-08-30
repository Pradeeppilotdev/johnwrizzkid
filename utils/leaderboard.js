import { createPublicClient, http } from 'viem';
import { monadTestnet } from './chains.js';

// Configuration
const CONFIG = {
  CACHE_DURATION: 120000, // 2 minutes cache
  MAX_RETRIES: 3, // Maximum number of retries for failed requests
  BASE_DELAY: 1000, // Base delay between requests in ms
  MAX_DELAY: 10000, // Maximum delay between retries in ms
  BATCH_SIZE: 5, // Number of requests to batch together
  BATCH_DELAY: 2000, // Delay between batches in ms
};

// Create public client with retry logic
const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http({
    retryCount: 3,
    retryDelay: (retryCount) => Math.min(2 ** retryCount * 1000, 10000), // Exponential backoff
  })
});

// Cache for leaderboard data to reduce RPC calls
let leaderboardCache = null;
let lastFetchTime = 0;

/**
 * Sleep function for rate limiting with jitter
 */
function sleep(ms, addJitter = true) {
  const jitter = addJitter ? Math.random() * 500 : 0; // Add up to 500ms jitter
  return new Promise(resolve => setTimeout(resolve, ms + jitter));
}

/**
 * Execute a contract read with retry logic
 */
async function readWithRetry(contractConfig, retryCount = 0) {
  try {
    console.log(`📡 RPC Request: ${contractConfig.functionName}`, contractConfig.args || '');
    const result = await publicClient.readContract(contractConfig);
    console.log(`✅ RPC Success: ${contractConfig.functionName}`, result);
    return result;
  } catch (error) {
    console.error(`❌ RPC Error (${retryCount + 1}/${CONFIG.MAX_RETRIES}) on ${contractConfig.functionName}:`, 
      error.shortMessage || error.message);
    
    if (retryCount >= CONFIG.MAX_RETRIES) {
      console.error('❌ Max retries reached. Error details:', {
        function: contractConfig.functionName,
        args: contractConfig.args,
        error: {
          name: error.name,
          message: error.message,
          code: error.code,
          details: error.details,
          stack: error.stack?.split('\n').slice(0, 3).join('\n')
        }
      });
      throw error;
    }
    
    // Exponential backoff with jitter
    const baseDelay = Math.min(CONFIG.BASE_DELAY * Math.pow(2, retryCount), CONFIG.MAX_DELAY);
    const jitter = Math.floor(Math.random() * 500);
    const delay = baseDelay + jitter;
    
    console.warn(`⏳ Retry ${retryCount + 1}/${CONFIG.MAX_RETRIES} after ${delay}ms...`);
    await sleep(delay, false);
    return readWithRetry(contractConfig, retryCount + 1);
  }
}

/**
 * Process items in batches with delay
 */
async function processInBatches(items, processFn, batchSize = CONFIG.BATCH_SIZE) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((item, index) => 
        sleep(index * 500).then(() => processFn(item, i + index))
      )
    );
    results.push(...batchResults);
    
    // Add delay between batches if not the last batch
    if (i + batchSize < items.length) {
      await sleep(CONFIG.BATCH_DELAY);
    }
  }
  return results;
}

/**
 * Fetch and sort leaderboard data from the SimpleFrameViewer contract
 * @param {string} contractAddress - The contract address
 * @param {boolean} forceRefresh - Force refresh cache
 * @returns {Array} Sorted leaderboard data
 */
export async function fetchLeaderboard(contractAddress = '0x2a2B24C36ee4734cd657c05c0B810f7adb38fb90', forceRefresh = false) {
  const now = Date.now();
  
  // Check cache first (unless force refresh)
  if (!forceRefresh && leaderboardCache && (now - lastFetchTime) < CACHE_DURATION) {
    console.log('📊 Using cached leaderboard data');
    return leaderboardCache;
  }

  // Contract ABI for the functions we need
  const abi = [
    {
      inputs: [],
      name: 'getAllPlayersCount',
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [{ name: 'index', type: 'uint256' }],
      name: 'getPlayerAtIndex',
      outputs: [{ name: '', type: 'address' }],
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
      name: 'getLastSlapTimestamp',
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    }
  ];

  try {
    console.log('🔄 Fetching fresh leaderboard data...');
    
    // Get total player count with retry
    const playerCount = await readWithRetry({
      address: contractAddress,
      abi,
      functionName: 'getAllPlayersCount',
      args: []
    });

    const playerCountNum = Number(playerCount);
    if (playerCountNum === 0) {
      console.log('📊 No players found');
      leaderboardCache = [];
      lastFetchTime = Date.now();
      return [];
    }

    // Limit to first 50 players to avoid rate limits
    const maxPlayers = Math.min(playerCountNum, 50);
    console.log(`📊 Fetching data for ${maxPlayers} players (out of ${playerCountNum} total)...`);
    
    // Generate indices for all players we want to fetch
    const playerIndices = Array.from({ length: maxPlayers }, (_, i) => i);
    
    // Process player addresses in batches
    const playerAddresses = [];
    try {
      await processInBatches(playerIndices, async (index) => {
        const address = await readWithRetry({
          address: contractAddress,
          abi,
          functionName: 'getPlayerAtIndex',
          args: [BigInt(index)]
        });
        playerAddresses.push(address);
        console.log(`✅ Fetched player ${index + 1}/${maxPlayers} address`);
        return address;
      });
    } catch (error) {
      console.error('❌ Error fetching player addresses:', error);
      if (playerAddresses.length === 0) throw error; // Only throw if we couldn't get any addresses
    }

    if (playerAddresses.length === 0) {
      console.log('❌ No player addresses could be fetched');
      return leaderboardCache || [];
    }

    // Process player data in batches
    const leaderboard = [];
    
    try {
      await processInBatches(playerAddresses, async (playerAddress, index) => {
        try {
          // Fetch both slap count and timestamp in parallel
          const [slapCount, lastSlapTimestamp] = await Promise.all([
            readWithRetry({
              address: contractAddress,
              abi,
              functionName: 'getSlapCount',
              args: [playerAddress]
            }),
            readWithRetry({
              address: contractAddress,
              abi,
              functionName: 'getLastSlapTimestamp',
              args: [playerAddress]
            })
          ]);

          const playerData = {
            user: playerAddress,
            slapCount: Number(slapCount),
            lastSlapTimestamp: Number(lastSlapTimestamp),
            rank: 0
          };
          
          leaderboard.push(playerData);
          console.log(`✅ Player ${index + 1}/${playerAddresses.length} loaded: ${playerAddress.slice(0, 6)}... (${playerData.slapCount} slaps)`);
          
          return playerData;
        } catch (error) {
          console.error(`❌ Error loading player ${index} data:`, error);
          return null;
        }
      });
    } catch (error) {
      console.error('❌ Error in player data batch processing:', error);
      if (leaderboard.length === 0) throw error; // Only throw if we couldn't get any player data
    }

    // Sort by slap count (descending), then by timestamp (ascending for tie-breaks)
    leaderboard.sort((a, b) => {
      if (a.slapCount !== b.slapCount) {
        return b.slapCount - a.slapCount;
      }
      return a.lastSlapTimestamp - b.lastSlapTimestamp;
    });

    // Assign ranks
    leaderboard.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    // Update cache
    leaderboardCache = leaderboard;
    lastFetchTime = now;

    console.log(`✅ Leaderboard updated with ${leaderboard.length} players`);
    return leaderboard;

  } catch (error) {
    console.error('❌ Error fetching leaderboard:', error);
    
    // If we have cached data, return it
    if (leaderboardCache) {
      console.log('⚠️ Returning cached data due to error');
      return leaderboardCache;
    }
    
    return [];
  }
}

/**
 * Get user rank from leaderboard data
 * @param {string} userAddress - User's address
 * @param {Array} leaderboardData - Leaderboard data
 * @returns {number} User's rank (0 if not found)
 */
export function getUserRank(userAddress, leaderboardData) {
  if (!userAddress || !leaderboardData || leaderboardData.length === 0) {
    return 0;
  }

  const userEntry = leaderboardData.find(entry => 
    entry.user.toLowerCase() === userAddress.toLowerCase()
  );

  return userEntry ? userEntry.rank : 0;
}

/**
 * Clear the leaderboard cache (useful after transactions)
 */
export function clearLeaderboardCache() {
  leaderboardCache = null;
  lastFetchTime = 0;
  console.log('🗑️ Leaderboard cache cleared');
}

/**
 * Get cache status for debugging
 */
export function getCacheStatus() {
  const now = Date.now();
  const timeSinceLastFetch = now - lastFetchTime;
  const isExpired = timeSinceLastFetch > CACHE_DURATION;
  
  return {
    hasCache: !!leaderboardCache,
    timeSinceLastFetch,
    isExpired,
    cacheDuration: CACHE_DURATION,
    playerCount: leaderboardCache ? leaderboardCache.length : 0
  };
}
