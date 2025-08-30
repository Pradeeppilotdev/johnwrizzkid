// Verification script for migration from GaslessFrameViewer to SimpleFrameViewer
// Run this after migration to verify data integrity

import { createPublicClient, http } from 'viem';
import { monadTestnet } from '../utils/chains.js';

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http()
});

// Contract addresses (update these)
const OLD_CONTRACT_ADDRESS = '0x...'; // Your current GaslessFrameViewer address
const NEW_CONTRACT_ADDRESS = '0x...'; // Your new SimpleFrameViewer address

// Old contract ABI (for verification)
const OLD_ABI = [
  {
    "inputs": [],
    "name": "getLeaderboardLength",
    "outputs": [{"type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"type": "uint256"}],
    "name": "leaderboard",
    "outputs": [
      {"type": "address"},
      {"type": "uint256"},
      {"type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// New contract ABI
const NEW_ABI = [
  {
    "inputs": [],
    "name": "getAllPlayersCount",
    "outputs": [{"type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"type": "uint256"}],
    "name": "getPlayerAtIndex",
    "outputs": [{"type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"type": "address"}],
    "name": "getSlapCount",
    "outputs": [{"type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"type": "address"}],
    "name": "getLastSlapTimestamp",
    "outputs": [{"type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

async function verifyMigration() {
  console.log('🔍 Verifying migration...\n');

  try {
    // 1. Get old contract data
    console.log('📊 Old Contract Data:');
    const oldLength = await publicClient.readContract({
      address: OLD_CONTRACT_ADDRESS,
      abi: OLD_ABI,
      functionName: 'getLeaderboardLength'
    });
    console.log(`Total players: ${oldLength}`);

    const oldData = [];
    for (let i = 0; i < Number(oldLength); i++) {
      const [user, slapCount, timestamp] = await publicClient.readContract({
        address: OLD_CONTRACT_ADDRESS,
        abi: OLD_ABI,
        functionName: 'leaderboard',
        args: [BigInt(i)]
      });
      oldData.push({ user, slapCount: Number(slapCount), timestamp: Number(timestamp) });
    }

    // 2. Get new contract data
    console.log('\n📊 New Contract Data:');
    const newLength = await publicClient.readContract({
      address: NEW_CONTRACT_ADDRESS,
      abi: NEW_ABI,
      functionName: 'getAllPlayersCount'
    });
    console.log(`Total players: ${newLength}`);

    const newData = [];
    for (let i = 0; i < Number(newLength); i++) {
      const user = await publicClient.readContract({
        address: NEW_CONTRACT_ADDRESS,
        abi: NEW_ABI,
        functionName: 'getPlayerAtIndex',
        args: [BigInt(i)]
      });
      
      const slapCount = await publicClient.readContract({
        address: NEW_CONTRACT_ADDRESS,
        abi: NEW_ABI,
        functionName: 'getSlapCount',
        args: [user]
      });
      
      const timestamp = await publicClient.readContract({
        address: NEW_CONTRACT_ADDRESS,
        abi: NEW_ABI,
        functionName: 'getLastSlapTimestamp',
        args: [user]
      });
      
      newData.push({ 
        user, 
        slapCount: Number(slapCount), 
        timestamp: Number(timestamp) 
      });
    }

    // 3. Compare data
    console.log('\n🔍 Data Comparison:');
    console.log('Old vs New:');
    
    let allMatch = true;
    for (let i = 0; i < oldData.length; i++) {
      const oldEntry = oldData[i];
      const newEntry = newData.find(n => n.user.toLowerCase() === oldEntry.user.toLowerCase());
      
      if (newEntry) {
        const slapCountMatch = oldEntry.slapCount === newEntry.slapCount;
        const timestampMatch = oldEntry.timestamp === newEntry.timestamp;
        
        console.log(`${i + 1}. ${oldEntry.user.slice(0, 8)}...`);
        console.log(`   Slaps: ${oldEntry.slapCount} → ${newEntry.slapCount} ${slapCountMatch ? '✅' : '❌'}`);
        console.log(`   Time: ${oldEntry.timestamp} → ${newEntry.timestamp} ${timestampMatch ? '✅' : '❌'}`);
        
        if (!slapCountMatch || !timestampMatch) {
          allMatch = false;
        }
      } else {
        console.log(`${i + 1}. ${oldEntry.user.slice(0, 8)}... ❌ NOT FOUND`);
        allMatch = false;
      }
    }

    // 4. Summary
    console.log('\n📋 Migration Summary:');
    console.log(`Total players migrated: ${newData.length}/${oldData.length}`);
    console.log(`Data integrity: ${allMatch ? '✅ PERFECT' : '❌ ISSUES FOUND'}`);
    
    if (allMatch) {
      console.log('\n🎉 Migration successful! All data preserved correctly.');
    } else {
      console.log('\n⚠️  Migration issues detected. Check the data above.');
    }

  } catch (error) {
    console.error('❌ Error during verification:', error);
  }
}

// Run verification
verifyMigration();


















