// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title SimpleFrameViewer
 * @dev Simple contract where each frame costs 0.001 MON directly from wallet
 * @dev Perfect for gasless transactions with Privy embedded wallets
 */
contract SimpleFrameViewer is Ownable, ReentrancyGuard {
    // Frame viewing cost: 0.001 MON per frame
    uint256 public constant FRAME_COST = 0.001 ether; // 0.001 MON in wei
    
    // User frame usage tracking
    mapping(address => uint256) public frameUsage;
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
    event FrameViewed(address indexed user, uint256 frameNumber, uint256 cost);
    event SlapStarted(address indexed user, uint256 timestamp);
    event SlapCompleted(address indexed user, uint256 slapCount, uint256 timestamp);
    event LeaderboardUpdated(address indexed user, uint256 slapCount, uint256 rank);

    constructor() Ownable(msg.sender) {}

    /**
     * @dev View a specific frame - each frame costs 0.001 MON
     * @param frameNumber The frame number to view (1-162)
     */
    function viewFrame(uint256 frameNumber) external payable nonReentrant {
        require(frameNumber >= 1 && frameNumber <= 162, "Invalid frame number");
        require(msg.value >= FRAME_COST, "Insufficient payment");
        
        frameUsage[msg.sender]++;
        
        // Track slap progress
        if (frameNumber == 1) {
            userCurrentSlapStart[msg.sender] = block.timestamp;
            emit SlapStarted(msg.sender, block.timestamp);
        } else if (frameNumber == 162 && userCurrentSlapStart[msg.sender] > 0) {
            userSlapCount[msg.sender]++;
            userCurrentSlapStart[msg.sender] = 0; // Reset slap progress
            emit SlapCompleted(msg.sender, userSlapCount[msg.sender], block.timestamp);
            updateLeaderboard(msg.sender);
        }
        
        emit FrameViewed(msg.sender, frameNumber, msg.value);
        
        // Refund excess payment
        if (msg.value > FRAME_COST) {
            payable(msg.sender).transfer(msg.value - FRAME_COST);
        }
    }

    /**
     * @dev Batch view multiple frames
     * @param frameNumbers Array of frame numbers to view
     */
    function viewFramesBatch(uint256[] calldata frameNumbers) external payable nonReentrant {
        uint256 totalCost = frameNumbers.length * FRAME_COST;
        require(msg.value >= totalCost, "Insufficient payment");
        
        bool hasFrame1 = false;
        bool hasFrame162 = false;
        
        for (uint256 i = 0; i < frameNumbers.length; i++) {
            uint256 frameNumber = frameNumbers[i];
            require(frameNumber >= 1 && frameNumber <= 162, "Invalid frame number");
            
            frameUsage[msg.sender]++;
            emit FrameViewed(msg.sender, frameNumber, FRAME_COST);
            
            if (frameNumber == 1) hasFrame1 = true;
            if (frameNumber == 162) hasFrame162 = true;
        }
        
        // Handle slap completion for batch
        if (hasFrame1) {
            userCurrentSlapStart[msg.sender] = block.timestamp;
            emit SlapStarted(msg.sender, block.timestamp);
        }
        
        if (hasFrame162 && userCurrentSlapStart[msg.sender] > 0) {
            userSlapCount[msg.sender]++;
            userCurrentSlapStart[msg.sender] = 0;
            emit SlapCompleted(msg.sender, userSlapCount[msg.sender], block.timestamp);
            updateLeaderboard(msg.sender);
        }
        
        // Refund excess payment
        if (msg.value > totalCost) {
            payable(msg.sender).transfer(msg.value - totalCost);
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
            // Update existing entry
            leaderboard[currentIndex - 1].slapCount = currentSlapCount;
            leaderboard[currentIndex - 1].lastSlapTimestamp = block.timestamp;
            emit LeaderboardUpdated(user, currentSlapCount, currentIndex);
        }
        
        // Sort leaderboard (simple bubble sort for small arrays)
        for (uint256 i = 0; i < leaderboard.length - 1; i++) {
            for (uint256 j = 0; j < leaderboard.length - i - 1; j++) {
                if (leaderboard[j].slapCount < leaderboard[j + 1].slapCount) {
                    // Swap entries
                    LeaderboardEntry memory temp = leaderboard[j];
                    leaderboard[j] = leaderboard[j + 1];
                    leaderboard[j + 1] = temp;
                    
                    // Update indices
                    userLeaderboardIndex[leaderboard[j].user] = j + 1;
                    userLeaderboardIndex[leaderboard[j + 1].user] = j + 2;
                }
            }
        }
    }

    // View functions
    function getFrameUsage(address user) external view returns (uint256) {
        return frameUsage[user];
    }

    function getSlapCount(address user) external view returns (uint256) {
        return userSlapCount[user];
    }

    function getCurrentSlapProgress(address user) external view returns (uint256) {
        return userCurrentSlapStart[user];
    }

    function getLeaderboardLength() external view returns (uint256) {
        return leaderboard.length;
    }

    function getUserRank(address user) external view returns (uint256) {
        return userLeaderboardIndex[user];
    }

    function getTopUsers(uint256 count) external view returns (address[] memory users, uint256[] memory slapCounts) {
        uint256 length = count < leaderboard.length ? count : leaderboard.length;
        users = new address[](length);
        slapCounts = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            users[i] = leaderboard[i].user;
            slapCounts[i] = leaderboard[i].slapCount;
        }
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // Owner functions
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        payable(owner()).transfer(balance);
    }

    // Emergency function to withdraw all funds
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        payable(owner()).transfer(balance);
    }
}
