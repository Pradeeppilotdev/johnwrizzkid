// Simple in-memory cache for usernames (resets on server restart)
const usernameCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Fetch global leaderboard from Monad Games ID site
    const upstream = await fetch('https://monad-games-id-site.vercel.app/api/leaderboard');
    if (!upstream.ok) {
      return res.status(502).json({ error: 'Upstream leaderboard unavailable' });
    }
    const data = await upstream.json();
    
    // Enrich leaderboard data with usernames
    const enrichedTop = [];
    if (data.top || data.top10) {
      const topEntries = data.top || data.top10;
      
      // Fetch usernames for each entry (limit to top 10 to avoid rate limiting)
      for (const entry of topEntries.slice(0, 10)) {
        try {
          if (entry.walletAddress || entry.address) {
            const walletAddr = entry.walletAddress || entry.address;
            
            // Check cache first
            const cacheKey = walletAddr.toLowerCase();
            const cached = usernameCache.get(cacheKey);
            const now = Date.now();
            
            if (cached && (now - cached.timestamp) < CACHE_TTL) {
              // Use cached username
              enrichedTop.push({
                ...entry,
                username: cached.username,
                displayName: cached.displayName
              });
            } else {
              // Fetch fresh username
              const usernameResp = await fetch(`https://monad-games-id-site.vercel.app/api/check-wallet?wallet=${walletAddr}`);
              
              if (usernameResp.ok) {
                const usernameData = await usernameResp.json();
                const username = usernameData.hasUsername && usernameData.user ? usernameData.user.username : null;
                const displayName = username || (walletAddr ? `${walletAddr.slice(0, 6)}...${walletAddr.slice(-4)}` : 'Player');
                
                // Cache the result
                usernameCache.set(cacheKey, {
                  username,
                  displayName,
                  timestamp: now
                });
                
                enrichedTop.push({
                  ...entry,
                  username,
                  displayName
                });
              } else {
                // Fallback if username fetch fails
                const displayName = walletAddr ? `${walletAddr.slice(0, 6)}...${walletAddr.slice(-4)}` : 'Player';
                enrichedTop.push({
                  ...entry,
                  username: null,
                  displayName
                });
              }
            }
          } else {
            enrichedTop.push({
              ...entry,
              username: null,
              displayName: 'Player'
            });
          }
        } catch (error) {
          console.error('Failed to fetch username for wallet:', entry.walletAddress || entry.address, error);
          // Fallback entry
          const walletAddr = entry.walletAddress || entry.address;
          enrichedTop.push({
            ...entry,
            username: null,
            displayName: walletAddr ? `${walletAddr.slice(0, 6)}...${walletAddr.slice(-4)}` : 'Player'
          });
        }
      }
    }

    // Normalize to a small shape for UI
    return res.status(200).json({
      top: enrichedTop,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Simple leaderboard API error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch leaderboard data',
      message: error.message 
    });
  }
}

