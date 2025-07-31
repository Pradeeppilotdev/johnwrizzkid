// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title FrameViewer - Slap System
 * @dev Smart contract for viewing frames with MON deductions only for slap start/end
 * @dev Tracks complete slaps for leaderboard
 */
contract FrameViewer is Ownable, ReentrancyGuard {
    uint256 public constant SLAP_START_COST = 0.001 ether; // 0.001 MON for frame 1
    uint256 public constant SLAP_END_COST = 0.001 ether;   // 0.001 MON for frame 162

    // User balances and tracking
    mapping(address => uint256) public userBalances;
    mapping(address => uint256) public userSlapCount;
    mapping(address => uint256) public userCurrentSlapStart;
    
    // Leaderboard tracking
    struct LeaderboardEntry {
        address user;
        uint256 slapCount;
        uint256 lastSlapTimestamp;
    }
    
    LeaderboardEntry[] public leaderboard;
    mapping(address => uint256) public userLeaderboardIndex; // 0 means not in leaderboard
    
    // Events
    event TokensDeposited(address indexed user, uint256 amount);
    event SlapStarted(address indexed user, uint256 timestamp);
    event SlapCompleted(address indexed user, uint256 slapCount, uint256 timestamp);
    event TokensWithdrawn(address indexed user, uint256 amount);
    event LeaderboardUpdated(address indexed user, uint256 slapCount, uint256 rank);

    constructor() Ownable() {}

    // Deposit native MON to the contract
    function depositTokens() external payable nonReentrant {
        require(msg.value > 0, "Amount must be greater than 0");
        userBalances[msg.sender] += msg.value;
        emit TokensDeposited(msg.sender, msg.value);
    }

    // View a specific frame - only frames 1 and 162 cost MON
    function viewFrame(uint256 frameNumber) external nonReentrant {
        require(frameNumber >= 1 && frameNumber <= 162, "Invalid frame number");
        
        if (frameNumber == 1) {
            // Start of a slap - deduct MON
            require(userBalances[msg.sender] >= SLAP_START_COST, "Insufficient balance for slap start");
            userBalances[msg.sender] -= SLAP_START_COST;
            userCurrentSlapStart[msg.sender] = block.timestamp;
            emit SlapStarted(msg.sender, block.timestamp);
        } else if (frameNumber == 162) {
            // End of a slap - deduct MON and complete slap
            require(userBalances[msg.sender] >= SLAP_END_COST, "Insufficient balance for slap end");
            require(userCurrentSlapStart[msg.sender] > 0, "No slap in progress");
            
            userBalances[msg.sender] -= SLAP_END_COST;
            userSlapCount[msg.sender]++;
            userCurrentSlapStart[msg.sender] = 0; // Reset slap progress
            
            emit SlapCompleted(msg.sender, userSlapCount[msg.sender], block.timestamp);
            updateLeaderboard(msg.sender);
        }
        // All other frames (2-161) are free to view
    }

    // Batch view multiple frames - only counts as one slap if includes both 1 and 162
    function viewFramesBatch(uint256[] calldata frameNumbers) external nonReentrant {
        bool hasFrame1 = false;
        bool hasFrame162 = false;
        uint256 totalCost = 0;

        for (uint256 i = 0; i < frameNumbers.length; i++) {
            uint256 frameNumber = frameNumbers[i];
            require(frameNumber >= 1 && frameNumber <= 162, "Invalid frame number");
            
            if (frameNumber == 1) {
                hasFrame1 = true;
                totalCost += SLAP_START_COST;
            } else if (frameNumber == 162) {
                hasFrame162 = true;
                totalCost += SLAP_END_COST;
            }
        }
        
        if (totalCost > 0) {
            require(userBalances[msg.sender] >= totalCost, "Insufficient balance");
            userBalances[msg.sender] -= totalCost;
            
            if (hasFrame1) {
                userCurrentSlapStart[msg.sender] = block.timestamp;
                emit SlapStarted(msg.sender, block.timestamp);
            }
            
            if (hasFrame162 && hasFrame1) {
                userSlapCount[msg.sender]++;
                userCurrentSlapStart[msg.sender] = 0;
                emit SlapCompleted(msg.sender, userSlapCount[msg.sender], block.timestamp);
                updateLeaderboard(msg.sender);
            }
        }
    }

    // Update leaderboard when user completes a slap
    function updateLeaderboard(address user) internal {
        uint256 currentSlapCount = userSlapCount[user];
        uint256 currentIndex = userLeaderboardIndex[user];
        
        if (currentIndex == 0) {
            // User not in leaderboard yet
            if (currentSlapCount > 0) {
                leaderboard.push(LeaderboardEntry({
                    user: user,
                    slapCount: currentSlapCount,
                    lastSlapTimestamp: block.timestamp
                }));
                userLeaderboardIndex[user] = leaderboard.length;
                emit LeaderboardUpdated(user, currentSlapCount, leaderboard.length);
            }
        } else {
            // User already in leaderboard, update their entry
            leaderboard[currentIndex - 1].slapCount = currentSlapCount;
            leaderboard[currentIndex - 1].lastSlapTimestamp = block.timestamp;
            emit LeaderboardUpdated(user, currentSlapCount, currentIndex);
        }
    }

    // Get user's balance in the contract
    function getBalance(address user) external view returns (uint256) {
        return userBalances[user];
    }

    // Get user's total slap count
    function getSlapCount(address user) external view returns (uint256) {
        return userSlapCount[user];
    }

    // Get user's current slap progress (0 = no slap in progress, >0 = slap started)
    function getCurrentSlapProgress(address user) external view returns (uint256) {
        return userCurrentSlapStart[user];
    }

    // Get leaderboard entry by index
    function getLeaderboardEntry(uint256 index) external view returns (address user, uint256 slapCount, uint256 lastSlapTimestamp) {
        require(index < leaderboard.length, "Index out of bounds");
        LeaderboardEntry memory entry = leaderboard[index];
        return (entry.user, entry.slapCount, entry.lastSlapTimestamp);
    }

    // Get leaderboard length
    function getLeaderboardLength() external view returns (uint256) {
        return leaderboard.length;
    }

    // Get user's leaderboard rank (0 = not in leaderboard)
    function getUserRank(address user) external view returns (uint256) {
        return userLeaderboardIndex[user];
    }

    // Get top N users from leaderboard
    function getTopUsers(uint256 count) external view returns (address[] memory users, uint256[] memory slapCounts) {
        uint256 length = count < leaderboard.length ? count : leaderboard.length;
        users = new address[](length);
        slapCounts = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            users[i] = leaderboard[i].user;
            slapCounts[i] = leaderboard[i].slapCount;
        }
    }

    // Withdraw native MON from the contract
    function withdrawTokens(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(userBalances[msg.sender] >= amount, "Insufficient balance");

        userBalances[msg.sender] -= amount;
        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "Withdraw failed");

        emit TokensWithdrawn(msg.sender, amount);
    }

    // Get contract's total MON balance
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // Emergency function to withdraw all MON (owner only)
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No tokens to withdraw");
        (bool sent, ) = owner().call{value: balance}("");
        require(sent, "Withdraw failed");
    }
}