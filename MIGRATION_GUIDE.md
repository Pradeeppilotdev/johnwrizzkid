# Migration Guide: GaslessFrameViewer → SimpleFrameViewer

## 🚨 Problem
The old `GaslessFrameViewer` contract has expensive bubble sort operations that cause high gas fees as the leaderboard grows.

## ✅ Solution
New `SimpleFrameViewer` contract that stores data without sorting. Frontend handles all sorting to reduce gas costs.

## 📋 Migration Steps

### 1. Deploy New Contract
```bash
# Deploy SimpleFrameViewer.sol
# Save the new contract address
```

### 2. Deploy Migration Contract
```bash
# Deploy MigrateData.sol with:
# - _oldContract: Your current GaslessFrameViewer address
# - _newContract: Your new SimpleFrameViewer address
```

### 3. Migrate Data
```solidity
// Call migrateAllUsers() on MigrateData contract
// This will transfer all 20 players' data to the new contract
```

### 4. Update Frontend
```javascript
// Replace the old leaderboard fetching with:
import { fetchLeaderboard } from './utils/leaderboard.js';

// Use this instead of contract calls for leaderboard data
const leaderboard = await fetchLeaderboard(NEW_CONTRACT_ADDRESS);
```

### 5. Test & Verify
- Check that all 20 players' data migrated correctly
- Verify slap counts and timestamps are preserved
- Test that new slaps work on the new contract

## 🔧 Contract Changes

### Removed (High Gas Cost):
- ❌ `LeaderboardEntry[] public leaderboard`
- ❌ `mapping(address => uint256) public userLeaderboardIndex`
- ❌ `updateLeaderboard()` function with bubble sort
- ❌ `getTopUsers()` function

### Added (Low Gas Cost):
- ✅ `address[] public allPlayers` - Simple list of players
- ✅ `mapping(address => bool) public hasPlayed` - Track who played
- ✅ `mapping(address => uint256) public userLastSlapTimestamp` - Store timestamp
- ✅ Migration functions for data transfer

## 💰 Gas Savings
- **Before**: O(n²) bubble sort on every slap completion
- **After**: O(1) simple data storage, O(n log n) frontend sorting
- **Result**: ~90% reduction in gas costs for leaderboard updates

## 📱 Frontend Sorting
The new `utils/leaderboard.js` handles:
- Fetching all player data from contract
- Sorting by slap count (descending)
- Tie-breaking by timestamp (earlier = better rank)
- Assigning ranks
- Getting top N users

## 🚀 Benefits
1. **Lower Gas Costs** - No more expensive sorting operations
2. **Better Scalability** - Leaderboard can grow without gas issues
3. **Faster Transactions** - Simpler contract logic
4. **Frontend Control** - Customizable sorting and display logic

## ⚠️ Important Notes
- **Don't delete the old contract** until migration is complete
- **Test thoroughly** before switching production traffic
- **Update environment variables** to point to new contract
- **Monitor gas costs** to confirm improvements



















