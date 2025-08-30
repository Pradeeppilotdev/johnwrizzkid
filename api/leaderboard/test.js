// Simple test for the leaderboard API
// You can run this with: node api/leaderboard/test.js

const fetch = require('node-fetch');

async function testLeaderboardAPI() {
  try {
    console.log('🧪 Testing leaderboard API...');
    
    // Test without user address
    const response1 = await fetch('http://localhost:3000/api/leaderboard');
    const data1 = await response1.json();
    console.log('✅ API response (no user):', {
      status: response1.status,
      top10Count: data1.top10?.length || 0,
      totalPlayers: data1.totalPlayers,
      lastUpdated: data1.lastUpdated
    });
    
    // Test with a sample user address
    const testUserAddress = '0x037b7E34779690caAa51EA122B40f4DB25C68E9c';
    const response2 = await fetch(`http://localhost:3000/api/leaderboard?userAddress=${testUserAddress}`);
    const data2 = await response2.json();
    console.log('✅ API response (with user):', {
      status: response2.status,
      top10Count: data2.top10?.length || 0,
      userRank: data2.userRank,
      userData: data2.userData,
      totalPlayers: data2.totalPlayers
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testLeaderboardAPI();









