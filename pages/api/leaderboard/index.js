import { createPublicClient, http } from 'viem';
import { monadTestnet } from '../../../utils/chains.js';

// Create public client for reading contract data
const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http()
});

// Contract ABI for the functions we need
const contractAbi = [
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

// Cache for leaderboard data
let leaderboardCache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 30000; // 30 seconds cache

/**
 * Sleep function for rate limiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch all leaderboard data from contract
 */
async function fetchAllLeaderboardData(contractAddress) {
  try {
    // Get total player count
    const playerCount = await publicClient.readContract({
      address: contractAddress,
      abi: contractAbi,
      functionName: 'getAllPlayersCount',
      args: []
    });

    const totalPlayers = Number(playerCount);
    if (totalPlayers === 0) {
      return [];
    }

    console.log(`📊 Fetching data for ${totalPlayers} players...`);
    
    const leaderboard = [];
    
    // Fetch data for all players with rate limiting
    for (let i = 0; i < totalPlayers; i++) {
      try {
        // Rate limiting: wait between requests
        if (i > 0) {
          await sleep(500); // 500ms delay
        }

        // Get player address
        const playerAddress = await publicClient.readContract({
          address: contractAddress,
          abi: contractAbi,
          functionName: 'getPlayerAtIndex',
          args: [BigInt(i)]
        });

        // Small delay
        await sleep(200);

        // Get slap count
        const slapCount = await publicClient.readContract({
          address: contractAddress,
          abi: contractAbi,
          functionName: 'getSlapCount',
          args: [playerAddress]
        });

        // Small delay
        await sleep(200);

        // Get timestamp
        const lastSlapTimestamp = await publicClient.readContract({
          address: contractAddress,
          abi: contractAbi,
          functionName: 'getLastSlapTimestamp',
          args: [playerAddress]
        });

        leaderboard.push({
          address: playerAddress,
          slapCount: Number(slapCount),
          lastSlapTimestamp: Number(lastSlapTimestamp)
        });

      } catch (error) {
        console.error(`❌ Error loading player ${i}:`, error);
        continue; // Continue with other players
      }
    }

    // Sort by slap count (descending), then by timestamp (ascending for tie-breaks)
    leaderboard.sort((a, b) => {
      if (a.slapCount !== b.slapCount) {
        return b.slapCount - a.slapCount; // Higher slap count first
      }
      return a.lastSlapTimestamp - b.lastSlapTimestamp; // Earlier timestamp first for ties
    });

    // Assign ranks
    leaderboard.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return leaderboard;

  } catch (error) {
    console.error('❌ Error fetching leaderboard data:', error);
    throw error;
  }
}

/**
 * Get leaderboard data (top 10 + current player)
 */
async function getLeaderboardData(contractAddress, userAddress = null) {
  const now = Date.now();
  
  // Check cache first
  if (leaderboardCache && (now - lastFetchTime) < CACHE_DURATION) {
    console.log('📊 Using cached leaderboard data');
  } else {
    console.log('🔄 Fetching fresh leaderboard data...');
    leaderboardCache = await fetchAllLeaderboardData(contractAddress);
    lastFetchTime = now;
  }

  const allData = leaderboardCache;
  if (!allData || allData.length === 0) {
    return {
      top10: [],
      userRank: 0,
      userData: null
    };
  }

  // Get top 10
  const top10 = allData.slice(0, 10).map(entry => ({
    rank: entry.rank,
    address: entry.address,
    slapCount: entry.slapCount
  }));

  // Find user data if provided
  let userRank = 0;
  let userData = null;

  if (userAddress) {
    const userEntry = allData.find(entry => 
      entry.address.toLowerCase() === userAddress.toLowerCase()
    );
    
    if (userEntry) {
      userRank = userEntry.rank;
      userData = {
        rank: userEntry.rank,
        address: userEntry.address,
        slapCount: userEntry.slapCount
      };
    }
  }

  return {
    top10,
    userRank,
    userData
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userAddress } = req.query;
    // Local contract leaderboard (existing game). Leaving as-is, but we will also expose global simple endpoint.
    const contractAddress = '0x2a2B24C36ee4734cd657c05c0B810f7adb38fb90';

    console.log(`📊 Leaderboard request for user: ${userAddress || 'none'}`);

    const leaderboardData = await getLeaderboardData(contractAddress, userAddress);

    // Return data in the format similar to the example you showed
    const response = {
      top10: leaderboardData.top10,
      userRank: leaderboardData.userRank,
      userData: leaderboardData.userData,
      totalPlayers: leaderboardCache ? leaderboardCache.length : 0,
      lastUpdated: new Date().toISOString()
    };

    // Set cache headers
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    
    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ Leaderboard API error:', error);
    
    // Return cached data if available, even if stale
    if (leaderboardCache) {
      console.log('⚠️ Returning cached data due to error');
      const fallbackData = {
        top10: leaderboardCache.slice(0, 10).map(entry => ({
          rank: entry.rank,
          address: entry.address,
          slapCount: entry.slapCount
        })),
        userRank: 0,
        userData: null,
        totalPlayers: leaderboardCache.length,
        lastUpdated: new Date(lastFetchTime).toISOString(),
        cached: true
      };
      return res.status(200).json(fallbackData);
    }
    
    return res.status(500).json({ 
      error: 'Failed to fetch leaderboard data',
      message: error.message 
    });
  }
}
