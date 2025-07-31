// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title FrameViewer
 * @dev Smart contract for viewing frames with MON token deductions
 * Optimized for high TPS usage with Pimlico paymaster integration
 */
contract FrameViewer is Ownable, ReentrancyGuard {
    IERC20 public monToken;
    
    // Frame viewing cost: 0.001 MON per frame
    uint256 public constant FRAME_COST = 0.001 ether; // 0.001 MON in wei
    
    // User balances and frame usage tracking
    mapping(address => uint256) public userBalances;
    mapping(address => uint256) public frameUsage;
    
    // Events
    event TokensDeposited(address indexed user, uint256 amount);
    event FrameViewed(address indexed user, uint256 frameNumber, uint256 cost);
    event TokensWithdrawn(address indexed user, uint256 amount);
    
    constructor(address _monToken) Ownable(msg.sender) {
        monToken = IERC20(_monToken);
    }
    
    /**
     * @dev Deposit MON tokens to the contract
     * @param amount Amount of MON tokens to deposit
     */
    function depositTokens(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(monToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        userBalances[msg.sender] += amount;
        emit TokensDeposited(msg.sender, amount);
    }
    
    /**
     * @dev View a specific frame, deducting 0.001 MON
     * @param frameNumber The frame number to view (1-162)
     */
    function viewFrame(uint256 frameNumber) external nonReentrant {
        require(frameNumber >= 1 && frameNumber <= 162, "Invalid frame number");
        require(userBalances[msg.sender] >= FRAME_COST, "Insufficient balance");
        
        userBalances[msg.sender] -= FRAME_COST;
        frameUsage[msg.sender]++;
        
        emit FrameViewed(msg.sender, frameNumber, FRAME_COST);
    }
    
    /**
     * @dev Batch view multiple frames in a single transaction
     * @param frameNumbers Array of frame numbers to view
     */
    function viewFramesBatch(uint256[] calldata frameNumbers) external nonReentrant {
        uint256 totalCost = frameNumbers.length * FRAME_COST;
        require(userBalances[msg.sender] >= totalCost, "Insufficient balance");
        
        userBalances[msg.sender] -= totalCost;
        frameUsage[msg.sender] += frameNumbers.length;
        
        for (uint256 i = 0; i < frameNumbers.length; i++) {
            require(frameNumbers[i] >= 1 && frameNumbers[i] <= 162, "Invalid frame number");
            emit FrameViewed(msg.sender, frameNumbers[i], FRAME_COST);
        }
    }
    
    /**
     * @dev Withdraw MON tokens from the contract
     * @param amount Amount of MON tokens to withdraw
     */
    function withdrawTokens(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(userBalances[msg.sender] >= amount, "Insufficient balance");
        
        userBalances[msg.sender] -= amount;
        require(monToken.transfer(msg.sender, amount), "Transfer failed");
        
        emit TokensWithdrawn(msg.sender, amount);
    }
    
    /**
     * @dev Get user's balance in the contract
     * @param user User address
     * @return User's balance in MON tokens
     */
    function getBalance(address user) external view returns (uint256) {
        return userBalances[user];
    }
    
    /**
     * @dev Get user's frame usage count
     * @param user User address
     * @return Number of frames viewed by the user
     */
    function getFrameUsage(address user) external view returns (uint256) {
        return frameUsage[user];
    }
    
    /**
     * @dev Get contract's total MON token balance
     * @return Total MON tokens held by the contract
     */
    function getContractBalance() external view returns (uint256) {
        return monToken.balanceOf(address(this));
    }
    
    /**
     * @dev Emergency function to withdraw all MON tokens (owner only)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = monToken.balanceOf(address(this));
        require(balance > 0, "No tokens to withdraw");
        require(monToken.transfer(owner(), balance), "Transfer failed");
    }
} 