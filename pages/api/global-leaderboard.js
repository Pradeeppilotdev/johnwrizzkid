// Global leaderboard API that fetches user's specific data from Monad Games ID
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userWallet } = req.query;
  
  if (!userWallet) {
    return res.status(400).json({ 
      error: 'userWallet query parameter is required',
      example: '/api/global-leaderboard?userWallet=0x1234...'
    });
  }

  try {
    console.log('🚀 Fetching global leaderboard data for user:', userWallet);
    console.log('🔍 Normalized user wallet:', userWallet.toLowerCase());
    
    // Fetch data from all pages to find the user's total score across all games
    const allScores = {};
    const userGameBreakdown = {};
    let totalPages = 0;
    let successfulPages = 0;
    let foundUserWallet = false;
    
    // Start with page 1 and continue until we get empty data
    for (let page = 1; page <= 100; page++) { // Limit to 100 pages max
      try {
        console.log(`📄 Fetching page ${page}...`);
        const response = await fetch(`https://monad-games-id-site.vercel.app/api/leaderboard?page=${page}`);
        
        if (!response.ok) {
          console.log(`⚠️ Page ${page} failed:`, response.status);
          break; // Stop if we hit an error
        }
        
        const data = await response.json();
        
        if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
          console.log(`📄 Page ${page} has no data, stopping`);
          break; // Stop if no more data
        }
        
        totalPages = page;
        successfulPages++;
        
        // Process each entry and aggregate scores by wallet
        data.data.forEach(entry => {
          const addr = entry.walletAddress?.toLowerCase();
          if (!addr) return;
          
          // Aggregate total score per wallet (transaction count)
          allScores[addr] = (allScores[addr] || 0) + (entry.transactionCount || 0);
          
          // Track game breakdown for the specific user
          if (addr === userWallet.toLowerCase()) {
            foundUserWallet = true;
            const gameName = entry.gameName || 'Unknown Game';
            userGameBreakdown[gameName] = (userGameBreakdown[gameName] || 0) + (entry.transactionCount || 0);
            console.log(`🎯 Found user wallet on page ${page} in game: ${gameName}, score: ${entry.transactionCount}`);
          }
        });
        
        console.log(`✅ Page ${page}: ${data.data.length} entries processed`);
        
        // Small delay to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`❌ Error on page ${page}:`, error.message);
        break; // Stop on error
      }
    }
    
    console.log(`📊 Processed ${successfulPages} pages, found ${Object.keys(allScores).length} unique wallets`);
    console.log(`🔍 User wallet found: ${foundUserWallet}`);
    
    // Debug: Show some sample wallet addresses to check format
    const sampleWallets = Object.keys(allScores).slice(0, 5);
    console.log('🔍 Sample wallet addresses found:', sampleWallets);
    console.log('🔍 Looking for wallet:', userWallet.toLowerCase());
    
    // Find the user's rank and score
    const userScore = allScores[userWallet.toLowerCase()] || 0;
    
    if (userScore === 0) {
      console.log('⚠️ User not found in global leaderboard');
      console.log('🔍 Available wallet addresses (first 10):', Object.keys(allScores).slice(0, 10));
      
      // Try to find a partial match
      const partialMatches = Object.keys(allScores).filter(addr => 
        addr.includes(userWallet.slice(2, 8).toLowerCase()) || // Check if partial address matches
        userWallet.toLowerCase().includes(addr.slice(2, 8))
      );
      
      if (partialMatches.length > 0) {
        console.log('🔍 Found partial matches:', partialMatches);
      }
      
      return res.status(200).json({
        user: {
          wallet: userWallet,
          score: 0,
          rank: 'Not ranked',
          displayName: 'Not ranked',
          gameBreakdown: {}
        },
        message: 'User not found in global leaderboard',
        debug: {
          userWallet: userWallet,
          userWalletLower: userWallet.toLowerCase(),
          totalWallets: Object.keys(allScores).length,
          pagesProcessed: successfulPages,
          sampleWallets: sampleWallets,
          partialMatches: partialMatches
        }
      });
    }
    
    // Calculate user's rank
    const sortedWallets = Object.entries(allScores)
      .sort(([, a], [, b]) => b - a);
    
    const userRank = sortedWallets.findIndex(([addr]) => addr === userWallet.toLowerCase()) + 1;
    
    console.log(`🏆 User rank: ${userRank}, score: ${userScore}`);
    
    // Try to resolve the user's username
    let username = null;
    let displayName = `${userWallet.slice(0, 6)}...${userWallet.slice(-4)}`;
    
    try {
      console.log('🔍 Resolving username for user...');
      const usernameResponse = await fetch(`https://monad-games-id-site.vercel.app/api/check-wallet?wallet=${userWallet}`);
      
      if (usernameResponse.ok) {
        const usernameData = await usernameResponse.json();
        if (usernameData.hasUsername && usernameData.user?.username) {
          username = usernameData.user.username;
          displayName = username;
          console.log('✅ Username resolved:', username);
        } else {
          console.log('⚠️ User has no username set');
        }
      }
    } catch (error) {
      console.log('⚠️ Could not resolve username:', error.message);
    }
    
    const result = {
      user: {
        wallet: userWallet,
        score: userScore,
        rank: userRank,
        displayName: displayName,
        username: username,
        gameBreakdown: userGameBreakdown
      },
      stats: {
        totalPlayers: Object.keys(allScores).length,
        pagesProcessed: successfulPages,
        topScore: sortedWallets[0]?.[1] || 0,
        userRank: userRank,
        userScore: userScore
      }
    };
    
    console.log('✅ Returning user data:', result);
    res.status(200).json(result);
    
  } catch (error) {
    console.error('❌ Global leaderboard error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch global leaderboard data',
      details: error.message
    });
  }
}
